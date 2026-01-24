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
        console.error('Error fetching user stats:', error);
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
    } : null;
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
    const sessionPlayers: SessionPlayer[] = playersData.map(p => ({
        user_id: p.id,
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

    // Get sessions where user is creator
    const { data: sessionsData, error } = await supabase
        .from('sessions')
        .select(`
      *,
      session_players(*)
    `)
        .eq('created_by', userId)
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
            user_id: p.id as string,
            username: p.username as string,
            session_score: parseFloat(p.session_score as string),
            is_guest: p.is_guest as boolean,
            avatar_color: p.avatar_color as string
        })),
        rounds: [], // Don't load all rounds for list view
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

        // Get current stats
        const currentStats = await getUserStats(sessionPlayer.user_id);
        if (currentStats) {
            await updateUserStats(sessionPlayer.user_id, {
                total_rounds_played: currentStats.total_rounds_played + 1,
                rounds_won: currentStats.rounds_won + (won ? 1 : 0)
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

    // 1. Mark session as completed
    await supabase
        .from('sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

    // 2. Fetch session details to calculate stats
    const session = await getSession(sessionId);
    if (!session) return;

    // 3. Update stats for all registered users in the session
    for (const player of session.players) {
        // Skip guests or if no user_id (shouldn't happen for registered users)
        if (player.is_guest || !player.user_id) continue;

        // Fetch current stats
        const currentStats = await getUserStats(player.user_id);

        // Calculate session earnings
        const earnings = player.session_score * session.point_value;
        const won = player.session_score > 0;

        // Prepare new stats
        if (currentStats) {
            await updateUserStats(player.user_id, {
                sessions_played: currentStats.sessions_played + 1,
                lifetime_earnings: currentStats.lifetime_earnings + earnings,
                total_rounds_played: currentStats.total_rounds_played + session.rounds.length,
                // Count rounds won (this is approximate if we don't track round-by-round here, 
                // but usually fine to increment by total wins in session if we had that data.
                // For now, let's just stick to session-level updates or we need to count round wins)

                // Correction: We should count round wins from the session rounds
                rounds_won: currentStats.rounds_won + session.rounds.filter(r => {
                    const score = r.points_awarded[player.user_id] || 0;
                    return score > 0;
                }).length,

                best_session: Math.max(currentStats.best_session, earnings),
                worst_session: Math.min(currentStats.worst_session, earnings)
            });
        }
    }
}
