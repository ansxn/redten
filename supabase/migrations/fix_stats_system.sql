-- =============================================================================
-- FINAL FIX: Recalculate All User Stats
-- After fixing the ID consistency issue in the app, run this to recalculate
-- all user stats based on the existing round_points data.
-- =============================================================================

-- Step 1: Reset all stats to 0
UPDATE user_stats SET
    total_rounds_played = 0,
    rounds_won = 0,
    lifetime_earnings = 0,
    sessions_played = 0,
    first_places = 0,
    total_placement_sum = 0;

-- Step 2: Recalculate rounds_won (rounds where points > 0)
UPDATE user_stats us
SET rounds_won = (
    SELECT COUNT(*)
    FROM round_points rp
    JOIN session_players sp ON rp.player_id = sp.id
    WHERE sp.user_id = us.user_id
    AND rp.points > 0
);

-- Step 3: Recalculate total_rounds_played
UPDATE user_stats us
SET total_rounds_played = (
    SELECT COUNT(*)
    FROM round_points rp
    JOIN session_players sp ON rp.player_id = sp.id
    WHERE sp.user_id = us.user_id
);

-- Step 4: Recalculate lifetime_earnings
UPDATE user_stats us
SET lifetime_earnings = COALESCE((
    SELECT SUM(rp.points)
    FROM round_points rp
    JOIN session_players sp ON rp.player_id = sp.id
    WHERE sp.user_id = us.user_id
), 0);

-- Step 5: Recalculate sessions_played
UPDATE user_stats us
SET sessions_played = (
    SELECT COUNT(DISTINCT sp.session_id)
    FROM session_players sp
    WHERE sp.user_id = us.user_id
);

-- Note: first_places and total_placement_sum cannot be recalculated because
-- placement data is not stored in round_points (only points are stored).
-- These would require parsing the rounds.finish_order JSON.
-- For now, leave them at 0.

-- =============================================================================
-- VERIFICATION: Check the results
-- =============================================================================
SELECT 
    p.username,
    us.user_id,
    us.total_rounds_played,
    us.rounds_won,
    us.lifetime_earnings,
    us.sessions_played,
    CASE WHEN us.total_rounds_played > 0 
        THEN ROUND(us.rounds_won::numeric / us.total_rounds_played * 100, 1)
        ELSE 0 
    END as win_rate_pct
FROM user_stats us
JOIN profiles p ON us.user_id = p.id
ORDER BY us.rounds_won DESC;
