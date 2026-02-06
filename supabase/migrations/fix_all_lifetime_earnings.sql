-- FIX: Recalculate ALL users' lifetime_earnings from actual session data
-- The bug was: lifetime_earnings was being updated with raw points instead of points * point_value

-- First, check what the correct values should be
SELECT 
    p.username,
    us.lifetime_earnings as current_stored,
    COALESCE(SUM(sp.session_score * s.point_value), 0) as correct_value,
    us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0) as difference
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
LEFT JOIN session_players sp ON sp.user_id = p.id
LEFT JOIN sessions s ON s.id = sp.session_id
GROUP BY p.username, us.lifetime_earnings
ORDER BY ABS(us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0)) DESC;

-- Apply the fix to ALL users
UPDATE user_stats 
SET lifetime_earnings = (
    SELECT COALESCE(SUM(sp.session_score * s.point_value), 0)
    FROM session_players sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.user_id = user_stats.user_id
);

-- Verify the fix
SELECT 
    p.username,
    us.lifetime_earnings as fixed_earnings
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
ORDER BY us.lifetime_earnings DESC;
