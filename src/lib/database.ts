/**
 * Supabase Database Service
 * Handles all database operations for sessions, rounds, and stats
 */

import { createClient } from './supabase';
import { Session, SessionPlayer, Round, UserStats, NewRoundData, User } from '@/types';
import { calculateRoundScores } from './scoring';

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
        rounds_lost: data.rounds_lost ?? undefined,
        placement_rounds: data.placement_rounds ?? undefined,
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
        id: p.id,  // session_players row ID
        user_id: p.user_id || null,  // auth user ID for stats
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
    // id = session_players row ID (for gameplay, round_points, finish_order)
    // user_id = auth user ID from profiles (for stats, null for guests)
    const rawPlayers: SessionPlayer[] = playersData.map(p => ({
        id: p.id,  // session_players row ID - THE gameplay identifier
        user_id: p.user_id || null,  // auth user ID for stats lookup
        username: p.username,
        session_score: parseFloat(p.session_score),
        is_guest: p.is_guest,
        avatar_color: p.avatar_color
    }));

    // De-duplicate players: if same user_id appears multiple times, merge them
    // Keep the entry with the most round_points references, sum their scores
    const playerMap = new Map<string, SessionPlayer>();
    for (const p of rawPlayers) {
        const key = p.user_id || p.id; // guests use their row id as key
        const existing = playerMap.get(key);
        if (existing) {
            // Keep the one with the higher absolute score (more activity)
            // and sum scores from duplicate rows
            existing.session_score += p.session_score;
        } else {
            playerMap.set(key, { ...p });
        }
    }
    const sessionPlayers = Array.from(playerMap.values());

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
        .or(participantSessionIds.length > 0
            ? `created_by.eq.${userId},id.in.(${participantSessionIds.join(',')})`
            : `created_by.eq.${userId}`)
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
            id: p.id as string,  // session_players row ID for gameplay
            user_id: (p.user_id as string) || null,  // auth user ID for stats
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

export type SaveRoundResult =
    | { ok: true; round: Round; updatedPlayers: SessionPlayer[] }
    | { ok: false; error: string };

/**
 * Save a round (new or edited) through the save_round RPC.
 * The RPC runs in a single transaction: round, red team, points, session
 * scores and every registered player's user_stats are updated together,
 * so a failure leaves nothing half-written. Stats are derived server-side.
 */
async function saveRound(
    sessionId: string,
    roundId: string | null,
    roundData: NewRoundData,
    players: SessionPlayer[]
): Promise<SaveRoundResult> {
    if (!supabase) return { ok: false, error: 'Database not configured' };

    const scores = calculateRoundScores(roundData, players);

    const { data, error } = await supabase.rpc('save_round', {
        p_session_id: sessionId,
        p_round_id: roundId,
        p_multiplier: roundData.multiplier,
        p_result: roundData.result,
        p_finish_order: roundData.finish_order || [],
        p_red_team: roundData.red_team_player_ids,
        p_points: scores
    });

    if (error || !data) {
        console.error('Error saving round:', error);
        return { ok: false, error: error?.message || 'Unknown error saving round' };
    }

    const serverScores = new Map<string, number>(
        (data.players as { id: string; session_score: number | string }[]).map(p => [p.id, Number(p.session_score)])
    );
    const updatedPlayers = players.map(p => ({
        ...p,
        session_score: serverScores.get(p.id) ?? p.session_score
    }));

    const round: Round = {
        id: data.round_id,
        round_number: data.round_number,
        multiplier: roundData.multiplier,
        red_team_player_ids: roundData.red_team_player_ids,
        finish_order: roundData.finish_order || [],
        result: roundData.result,
        points_awarded: scores,
        created_at: data.created_at
    };

    return { ok: true, round, updatedPlayers };
}

export async function addRound(
    sessionId: string,
    roundData: NewRoundData,
    players: SessionPlayer[]
): Promise<SaveRoundResult> {
    return saveRound(sessionId, null, roundData, players);
}

export async function endSession(sessionId: string): Promise<boolean> {
    if (!supabase) return false;

    // Mark session as completed
    const { data, error, count } = await supabase
        .from('sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select();

    if (error) {
        console.error('Error ending session:', error);
        return false;
    }

    // RLS can silently block the update (0 rows matched) — detect this
    if (!data || data.length === 0) {
        console.error('End session failed: no rows updated (likely RLS block — you may not be the session creator)');
        return false;
    }

    return true;
}

export async function updateRound(
    sessionId: string,
    roundId: string,
    roundData: NewRoundData,
    players: SessionPlayer[]
): Promise<SaveRoundResult> {
    return saveRound(sessionId, roundId, roundData, players);
}
