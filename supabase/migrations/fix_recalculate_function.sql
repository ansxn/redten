-- FIX: The recalculate_user_stats function was using raw points instead of dollars
-- This fix updates it to calculate lifetime_earnings correctly: SUM(session_score * point_value)

-- Step 1: Fix the recalculate_user_stats function
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    round_stats RECORD;
    session_stats RECORD;
    earnings_total DECIMAL(10,2);
BEGIN
    -- Round stats (rounds played, rounds won)
    SELECT 
        COALESCE(COUNT(DISTINCT rp.round_id), 0) as rounds_played,
        COALESCE(COUNT(DISTINCT CASE WHEN rp.points > 0 THEN rp.round_id END), 0) as rounds_won
    INTO round_stats
    FROM public.round_points rp
    JOIN public.session_players sp ON sp.id = rp.player_id
    WHERE sp.user_id = target_user_id;

    -- Session stats (count, best, worst - in raw points for now)
    SELECT 
        COALESCE(COUNT(DISTINCT sp.session_id), 0) as sessions_count,
        COALESCE(MAX(sp.session_score), 0) as best,
        COALESCE(MIN(sp.session_score), 0) as worst
    INTO session_stats
    FROM public.session_players sp
    WHERE sp.user_id = target_user_id;
    
    -- FIXED: Calculate lifetime_earnings in DOLLARS (session_score * point_value)
    SELECT COALESCE(SUM(sp.session_score * s.point_value), 0)
    INTO earnings_total
    FROM public.session_players sp
    JOIN public.sessions s ON s.id = sp.session_id
    WHERE sp.user_id = target_user_id;
    
    INSERT INTO public.user_stats (user_id, total_rounds_played, rounds_won, lifetime_earnings, sessions_played, best_session, worst_session)
    VALUES (target_user_id, round_stats.rounds_played, round_stats.rounds_won, earnings_total, session_stats.sessions_count, session_stats.best, session_stats.worst)
    ON CONFLICT (user_id) DO UPDATE SET
        total_rounds_played = round_stats.rounds_played,
        rounds_won = round_stats.rounds_won,
        lifetime_earnings = earnings_total,
        sessions_played = session_stats.sessions_count,
        best_session = session_stats.best,
        worst_session = session_stats.worst,
        updated_at = NOW();
END;
$$;

-- Step 2: Disable the session_completed trigger to prevent double-counting
-- (The round_points trigger already recalculates everything correctly now)
DROP TRIGGER IF EXISTS on_session_completed ON public.sessions;

-- Step 3: Recalculate ALL users' stats from scratch using the fixed function
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT DISTINCT user_id FROM public.user_stats LOOP
        PERFORM recalculate_user_stats(user_record.user_id);
    END LOOP;
END $$;

-- Step 4: Verify the fix
SELECT 
    p.username,
    us.lifetime_earnings as fixed_earnings,
    us.total_rounds_played,
    us.rounds_won
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
ORDER BY p.username;
