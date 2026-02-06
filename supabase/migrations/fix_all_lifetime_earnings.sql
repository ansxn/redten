-- FIX NOW: Recalculate ALL users' lifetime_earnings correctly
-- Run this entire file - it will fix everyone

-- First show the preview
SELECT 
    p.username,
    us.lifetime_earnings as before_fix,
    COALESCE(SUM(sp.session_score * s.point_value), 0) as after_fix,
    us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0) as was_off_by
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
LEFT JOIN session_players sp ON sp.user_id = p.id
LEFT JOIN sessions s ON s.id = sp.session_id
GROUP BY p.username, us.lifetime_earnings
ORDER BY ABS(us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0)) DESC;

-- APPLY THE FIX
UPDATE user_stats 
SET lifetime_earnings = (
    SELECT COALESCE(SUM(sp.session_score * s.point_value), 0)
    FROM session_players sp
    JOIN sessions s ON s.id = sp.session_id
    WHERE sp.user_id = user_stats.user_id
);

-- Verify everyone is fixed (all should show 0 difference)
SELECT 
    p.username,
    us.lifetime_earnings as fixed_value,
    COALESCE(SUM(sp.session_score * s.point_value), 0) as calculated,
    us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0) as difference
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
LEFT JOIN session_players sp ON sp.user_id = p.id
LEFT JOIN sessions s ON s.id = sp.session_id
GROUP BY p.username, us.lifetime_earnings
ORDER BY p.username;
