-- FIX: Recalculate Karen's stats from actual session_players data
-- Since round_points are incomplete, we'll use session_players.session_score as source of truth

-- First, check the correct values
SELECT 
    p.username,
    p.id as user_id,
    SUM(sp.session_score * s.point_value) as correct_lifetime_earnings,
    COUNT(DISTINCT sp.session_id) as session_count
FROM profiles p
JOIN session_players sp ON sp.user_id = p.id
JOIN sessions s ON s.id = sp.session_id
WHERE p.username ILIKE '%karen%'
GROUP BY p.username, p.id;

-- Apply the fix (uncomment to run)
/*
UPDATE user_stats 
SET lifetime_earnings = (
    SELECT COALESCE(SUM(sp.session_score * s.point_value), 0)
    FROM session_players sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.user_id = user_stats.user_id
)
WHERE user_id = (
    SELECT id FROM profiles WHERE username ILIKE '%karen%'
);
*/

-- For ALL users - recalculate lifetime_earnings from session scores
-- This is the safest approach since session_players.session_score is reliable
/*
UPDATE user_stats 
SET lifetime_earnings = (
    SELECT COALESCE(SUM(sp.session_score * s.point_value), 0)
    FROM session_players sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.user_id = user_stats.user_id
);
*/
