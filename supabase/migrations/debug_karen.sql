-- DEBUG: Check Karen's lifetime_earnings calculation
-- Find Karen's user

-- 1. Karen's user_stats
SELECT 
    p.username,
    us.lifetime_earnings,
    us.total_rounds_played,
    us.rounds_won,
    us.total_placement_sum
FROM profiles p
JOIN user_stats us ON us.user_id = p.id
WHERE p.username ILIKE '%karen%';

-- 2. Karen's actual session scores (what should be her total)
SELECT 
    p.username,
    s.name as session_name,
    sp.session_score,
    s.point_value,
    sp.session_score * s.point_value as dollar_value
FROM profiles p
JOIN session_players sp ON sp.user_id = p.id
JOIN sessions s ON s.id = sp.session_id
WHERE p.username ILIKE '%karen%'
ORDER BY s.created_at DESC;

-- 3. Sum of Karen's round_points (raw points, not dollars)
SELECT 
    p.username,
    SUM(rp.points) as total_round_points
FROM profiles p
JOIN session_players sp ON sp.user_id = p.id
JOIN rounds r ON r.session_id = sp.session_id
JOIN round_points rp ON rp.round_id = r.id AND rp.player_id = sp.id
WHERE p.username ILIKE '%karen%'
GROUP BY p.username;

-- 4. Check if there are duplicate round_points or multiple session_player entries
SELECT 
    p.username,
    sp.session_id,
    sp.id as session_player_id,
    COUNT(rp.id) as point_records
FROM profiles p
JOIN session_players sp ON sp.user_id = p.id
JOIN rounds r ON r.session_id = sp.session_id
LEFT JOIN round_points rp ON rp.round_id = r.id AND rp.player_id = sp.id
WHERE p.username ILIKE '%karen%'
GROUP BY p.username, sp.session_id, sp.id;
