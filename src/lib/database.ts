/**
 * Supabase Database Service
 * Handles all database operations for sessions, rounds, and stats
 */

import { createClient } from './supabase';
import { Session, SessionPlayer, Round, UserStats, NewRoundData, generateId, User } from '@/types';
import { calculateRoundScores, applyRoundScores } from './scoring';

const supabase = createClient();

// ============ USER STATS ============

export async function getUserStats(userId: string): Promise<UserStats | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        // PGRST116 means no rows found - not a real error
        if (error.code !== 'PGRST116') {
            console.error('Error fetching user stats:', error);
        }
        return null;
    }

    return data ? {
        user_id: data.user_id,
        total_rounds_played: data.total_rounds_played,
        rounds_won: data.rounds_won,
        lifetime_earnings: parseFloat(data.lifetime_earnings),
        sessions_played: data.sessions_played,
        best_session: parseFloat(data.best_session),
        worst_session: parseFloat(data.worst_session),
        first_places: data.first_places || 0,
        total_placement_sum: data.total_placement_sum || 0,
    } : null;
}

// Get existing stats or create a new row with defaults
export async function getOrCreateUserStats(userId: string): Promise<UserStats> {
    const existing = await getUserStats(userId);
    if (existing) return existing;

    // Create new stats row - only if one doesn't exist
    const defaultStats: UserStats = {
        user_id: userId,
        total_rounds_played: 0,
        rounds_won: 0,
        lifetime_earnings: 0,
        sessions_played: 0,
        best_session: 0,
        worst_session: 0,
    };

    if (supabase) {
        // Use upsert with onConflict: 'ignore' to avoid overwriting existing data
        await supabase.from('user_stats').upsert({
            user_id: userId,
            total_rounds_played: 0,
            rounds_won: 0,
            lifetime_earnings: 0,
            sessions_played: 0,
            best_session: 0,
            worst_session: 0
        }, { onConflict: 'user_id', ignoreDuplicates: true });

        // After insert/upsert, fetch the actual data (which may have existing values)
        const actualStats = await getUserStats(userId);
        if (actualStats) return actualStats;
    }

    return defaultStats;
}

export async function updateUserStats(userId: string, updates: Partial<UserStats>): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
        .from('user_stats')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating user stats:', error);
    }
}

export async function getUserProfile(userId: string): Promise<User | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }

    return data ? {
        id: data.id,
        username: data.username,
        // email: data.email, // Email is not in public profiles table
        created_at: data.created_at,
        avatar_color: data.avatar_color
    } : null;
}

// ============ SESSIONS ============

export async function createSession(
    userId: string,
    name: string | undefined,
    pointValue: number,
    players: { username: string; isGuest: boolean; avatarColor: string; userId?: string }[]
): Promise<Session | null> {
    if (!supabase) return null;

    // Create session
    const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
            created_by: userId,
            name,
            point_value: pointValue,
            status: 'active'
        })
        .select()
        .single();

    if (sessionError || !sessionData) {
        console.error('Error creating session:', sessionError);
        return null;
    }

    // Add players - link real user IDs for stat tracking
    const playerInserts = players.map(p => ({
        session_id: sessionData.id,
        user_id: p.isGuest ? null : (p.userId || null),  // Link real user ID if not guest
        username: p.username,
        is_guest: p.isGuest,
        avatar_color: p.avatarColor,
        session_score: 0
    }));

    const { data: playersData, error: playersError } = await supabase
        .from('session_players')
        .insert(playerInserts)
        .select();

    if (playersError) {
        console.error('Error adding players:', playersError);
        return null;
    }

    // Convert to our Session type
    const sessionPlayers: SessionPlayer[] = playersData.map(p => ({
        user_id: p.id, // Use the session_player id as user_id for this session
        username: p.username,
        session_score: parseFloat(p.session_score),
        is_guest: p.is_guest,
        avatar_color: p.avatar_color
    }));

    return {
        id: sessionData.id,
        created_at: sessionData.created_at,
        created_by: sessionData.created_by,
        players: sessionPlayers,
        rounds: [],
        status: sessionData.status,
        point_value: parseFloat(sessionData.point_value),
        name: sessionData.name
    };
}

export async function getSession(sessionId: string): Promise<Session | null> {
    if (!supabase) return null;

    // Fetch session
    const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !sessionData) {
        console.error('Error fetching session:', sessionError);
        return null;
    }

    // Fetch players
    const { data: playersData, error: playersError } = await supabase
        .from('session_players')
        .select('*')
        .eq('session_id', sessionId);

    if (playersError) {
        console.error('Error fetching players:', playersError);
        return null;
    }

    // Fetch rounds
    const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select(`
      *,
      round_red_team(player_id),
      round_points(player_id, points)
    `)
        .eq('session_id', sessionId)
        .order('round_number', { ascending: true });

    if (roundsError) {
        console.error('Error fetching rounds:', roundsError);
        return null;
    }

    // Convert to our types
    // NOTE: p.id is the session_players row ID, p.user_id is the actual profiles FK
    const sessionPlayers: SessionPlayer[] = playersData.map(p => ({
        user_id: p.user_id || p.id, // Use actual user_id, fallback to row id for guests
        username: p.username,
        session_score: parseFloat(p.session_score),
        is_guest: p.is_guest,
        avatar_color: p.avatar_color
    }));

    const rounds: Round[] = (roundsData || []).map(r => ({
        id: r.id,
        round_number: r.round_number,
        multiplier: r.multiplier as 1 | 2 | 4,
        red_team_player_ids: r.round_red_team?.map((rt: { player_id: string }) => rt.player_id) || [],
        finish_order: r.finish_order || [],
        result: r.result as 'red_win' | 'blue_win' | 'wash',
        points_awarded: Object.fromEntries(
            (r.round_points || []).map((rp: { player_id: string; points: string }) => [rp.player_id, parseFloat(rp.points)])
        ),
        created_at: r.created_at
    }));

    return {
        id: sessionData.id,
        created_at: sessionData.created_at,
        created_by: sessionData.created_by,
        players: sessionPlayers,
        rounds,
        status: sessionData.status,
        point_value: parseFloat(sessionData.point_value),
        name: sessionData.name
    };
}

export async function getUserSessions(userId: string): Promise<Session[]> {
    if (!supabase) return [];

    // First, get session IDs where user is a participant (via session_players.user_id)
    const { data: participantSessions } = await supabase
        .from('session_players')
        .select('session_id')
        .eq('user_id', userId);

    const participantSessionIds = participantSessions?.map(p => p.session_id) || [];

    // Get sessions where user is creator OR participant
    const { data: sessionsData, error } = await supabase
        .from('sessions')
        .select(`
      *,
      session_players(*),
      rounds(id)
    `)
        .or(`created_by.eq.${userId},id.in.(${participantSessionIds.join(',')})`)
        .order('created_at', { ascending: false });

    if (error || !sessionsData) {
        console.error('Error fetching user sessions:', error);
        return [];
    }

    return sessionsData.map(s => ({
        id: s.id,
        created_at: s.created_at,
        created_by: s.created_by,
        players: s.session_players.map((p: Record<string, unknown>) => ({
            user_id: (p.user_id as string) || (p.id as string), // Use actual user_id, fallback to row id for guests
            username: p.username as string,
            session_score: parseFloat(p.session_score as string),
            is_guest: p.is_guest as boolean,
            avatar_color: p.avatar_color as string
        })),
        rounds: (s.rounds || []).map((r: { id: string }) => ({ id: r.id })) as unknown as Round[], // Just IDs for count
        status: s.status,
        point_value: parseFloat(s.point_value),
        name: s.name
    }));
}

export async function addRound(
    sessionId: string,
    roundData: NewRoundData,
    players: SessionPlayer[]
): Promise<{ round: Round; updatedPlayers: SessionPlayer[] } | null> {
    if (!supabase) return null;

    // Calculate scores
    const scores = calculateRoundScores(roundData, players);
    const updatedPlayers = applyRoundScores(players, scores);

    // Get current round count
    const { count } = await supabase
        .from('rounds')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

    const roundNumber = (count || 0) + 1;

    // Create round
    const { data: roundDbData, error: roundError } = await supabase
        .from('rounds')
        .insert({
            session_id: sessionId,
            round_number: roundNumber,
            multiplier: roundData.multiplier,
            result: roundData.result,
            finish_order: roundData.finish_order || []
        })
        .select()
        .single();

    if (roundError || !roundDbData) {
        console.error('Error creating round:', roundError);
        return null;
    }

    // Add red team
    if (roundData.red_team_player_ids.length > 0) {
        const redTeamInserts = roundData.red_team_player_ids.map(playerId => ({
            round_id: roundDbData.id,
            player_id: playerId
        }));

        await supabase.from('round_red_team').insert(redTeamInserts);
    }

    // Add points (only if there are any - washes have no points)
    const pointsInserts = Object.entries(scores).map(([playerId, points]) => ({
        round_id: roundDbData.id,
        player_id: playerId,
        points
    }));

    if (pointsInserts.length > 0) {
        await supabase.from('round_points').insert(pointsInserts);
    }

    // Update player scores
    for (const player of updatedPlayers) {
        await supabase
            .from('session_players')
            .update({ session_score: player.session_score })
            .eq('id', player.user_id);
    }

    // Update user_stats for each registered player in the round
    for (const player of players) {
        if (player.is_guest) continue;

        // Get the actual user_id from session_players table
        const { data: sessionPlayer } = await supabase
            .from('session_players')
            .select('user_id')
            .eq('id', player.user_id)
            .single();

        if (!sessionPlayer?.user_id) continue;

        const pointsForPlayer = scores[player.user_id] || 0;
        const won = pointsForPlayer > 0;

        // Calculate placement (1-6 based on finish_order, 0 if not found)
        const finishOrder = roundData.finish_order || [];
        const placementIndex = finishOrder.indexOf(player.user_id);
        const placement = placementIndex >= 0 ? placementIndex + 1 : 0;
        const gotFirst = placement === 1;

        // Get current stats or create defaults
        const currentStats = await getUserStats(sessionPlayer.user_id);

        if (currentStats) {
            // Update existing stats with placement tracking
            await updateUserStats(sessionPlayer.user_id, {
                total_rounds_played: currentStats.total_rounds_played + 1,
                rounds_won: currentStats.rounds_won + (won ? 1 : 0),
                first_places: (currentStats.first_places || 0) + (gotFirst ? 1 : 0),
                total_placement_sum: (currentStats.total_placement_sum || 0) + placement
            });
        } else {
            // Create new stats row via upsert
            await supabase.from('user_stats').upsert({
                user_id: sessionPlayer.user_id,
                total_rounds_played: 1,
                rounds_won: won ? 1 : 0,
                lifetime_earnings: 0,
                sessions_played: 0,
                best_session: 0,
                worst_session: 0,
                first_places: gotFirst ? 1 : 0,
                total_placement_sum: placement
            });
        }
    }

    const round: Round = {
        id: roundDbData.id,
        round_number: roundNumber,
        multiplier: roundData.multiplier,
        red_team_player_ids: roundData.red_team_player_ids,
        finish_order: roundData.finish_order || [],
        result: roundData.result,
        points_awarded: scores,
        created_at: roundDbData.created_at
    };

    return { round, updatedPlayers };
}

export async function endSession(sessionId: string): Promise<void> {
    if (!supabase) return;

    // Mark session as completed
    // NOTE: A database trigger (handle_session_completed) automatically updates
    // user_stats for all players when status changes to 'completed'
    const { error } = await supabase
        .from('sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (error) {
        console.error('Error ending session:', error);
    }
}

export async function updateRound(
    sessionId: string,
    roundId: string,
    roundData: NewRoundData,
    players: SessionPlayer[]
): Promise<{ updatedPlayers: SessionPlayer[] } | null> {
    if (!supabase) return null;

    // 1. Update the round metadata
    const { error: updateError } = await supabase
        .from('rounds')
        .update({
            multiplier: roundData.multiplier,
            result: roundData.result,
            finish_order: roundData.finish_order || []
        })
        .eq('id', roundId);

    if (updateError) {
        console.error('Error updating round:', updateError);
        return null;
    }

    // 2. Update Red Team (Delete old, Insert new)
    await supabase.from('round_red_team').delete().eq('round_id', roundId);

    if (roundData.red_team_player_ids.length > 0) {
        const redTeamInserts = roundData.red_team_player_ids.map(playerId => ({
            round_id: roundId,
            player_id: playerId
        }));
        await supabase.from('round_red_team').insert(redTeamInserts);
    }

    // 3. Recalculate scores for THIS round
    const scores = calculateRoundScores(roundData, players);

    // 4. Update Points (Delete old, Insert new)
    await supabase.from('round_points').delete().eq('round_id', roundId);

    const pointsInserts = Object.entries(scores).map(([playerId, points]) => ({
        round_id: roundId,
        player_id: playerId,
        points
    }));

    if (pointsInserts.length > 0) {
        await supabase.from('round_points').insert(pointsInserts);
    }

    // 5. CRITICAL: Recalculate ALL session scores from scratch
    // We can't just apply diffs because we might have edited a round in the middle
    // Easier to just re-sum everything from the database

    // First, get all round IDs for this session
    const { data: sessionRounds } = await supabase
        .from('rounds')
        .select('id')
        .eq('session_id', sessionId);

    const roundIds = sessionRounds?.map(r => r.id) || [];

    // Then get all points for those rounds
    const { data: allRoundPoints } = roundIds.length > 0
        ? await supabase
            .from('round_points')
            .select('player_id, points')
            .in('round_id', roundIds)
        : { data: [] };

    const playerTotals: Record<string, number> = {};

    // Initialize with 0
    players.forEach(p => playerTotals[p.user_id] = 0);

    // Sum points - NOTE: points come as string from database, need parseFloat
    allRoundPoints?.forEach((rp: { player_id: string; points: string | number }) => {
        if (playerTotals[rp.player_id] !== undefined) {
            const pointValue = typeof rp.points === 'string' ? parseFloat(rp.points) : rp.points;
            playerTotals[rp.player_id] += pointValue;
        }
    });

    // 6. Update session_players with new totals
    const updatedPlayers = players.map(p => ({
        ...p,
        session_score: playerTotals[p.user_id] || 0
    }));

    for (const player of updatedPlayers) {
        await supabase
            .from('session_players')
            .update({ session_score: player.session_score })
            .eq('id', player.user_id);
    }

    // Note: User Stats (lifetime earnings etc) are handled by DB Triggers now!
    // We don't need to manually update them here.

    return { updatedPlayers };
}
