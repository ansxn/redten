-- DEBUG: Check this user's earnings calculation
-- Find the discrepancy between stored stats and actual session data

-- 1. Check all users' stored vs calculated earnings
SELECT 
    p.username,
    us.lifetime_earnings as stored_earnings,
    COALESCE(SUM(sp.session_score * s.point_value), 0) as calculated_earnings,
    us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0) as discrepancy
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
LEFT JOIN session_players sp ON sp.user_id = p.id
LEFT JOIN sessions s ON s.id = sp.session_id
GROUP BY p.username, us.lifetime_earnings
HAVING ABS(us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0)) > 0.01
ORDER BY ABS(us.lifetime_earnings - COALESCE(SUM(sp.session_score * s.point_value), 0)) DESC;

-- 2. For the user in the screenshot, check round-by-round addRound updates
-- Looking for: is lifetime_earnings being updated per-round correctly?
-- The issue might be: points are being added as raw points AND as dollars

-- 3. Check for this specific user
SELECT 
    p.username,
    p.id as user_id,
    us.lifetime_earnings as stored,
    SUM(sp.session_score) as raw_points_sum,
    SUM(sp.session_score * s.point_value) as dollar_sum
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
LEFT JOIN session_players sp ON sp.user_id = p.id
LEFT JOIN sessions s ON s.id = sp.session_id
GROUP BY p.username, p.id, us.lifetime_earnings;
