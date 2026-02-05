-- DEBUG: Check ALL players' round_points for Steph's completed session
-- Session ID: 2efc972a-5acd-4d6c-b968-90d61daca9d4

-- 1. Who are all the players in this session?
SELECT 
    sp.id as session_player_id,
    sp.user_id,
    sp.username,
    sp.session_score,
    sp.is_guest
FROM session_players sp
WHERE sp.session_id = '2efc972a-5acd-4d6c-b968-90d61daca9d4';

-- 2. Check if ANY round_points exist for this session's rounds
SELECT 
    r.round_number,
    rp.player_id,
    rp.points,
    sp.username as player_name
FROM rounds r
LEFT JOIN round_points rp ON rp.round_id = r.id
LEFT JOIN session_players sp ON sp.id = rp.player_id
WHERE r.session_id = '2efc972a-5acd-4d6c-b968-90d61daca9d4'
ORDER BY r.round_number, rp.points DESC;

-- 3. Total round_points count for this session
SELECT COUNT(*) as total_round_points
FROM round_points rp
JOIN rounds r ON r.id = rp.round_id
WHERE r.session_id = '2efc972a-5acd-4d6c-b968-90d61daca9d4';

-- 4. Compare: Check a DIFFERENT session that works correctly
-- (Pick anson's session that we know has data)
SELECT 
    s.id as session_id,
    s.name,
    COUNT(DISTINCT r.id) as round_count,
    COUNT(rp.id) as total_round_points
FROM sessions s
JOIN rounds r ON r.session_id = s.id
LEFT JOIN round_points rp ON rp.round_id = r.id
GROUP BY s.id, s.name
ORDER BY round_count DESC
LIMIT 10;
