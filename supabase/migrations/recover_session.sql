-- =============================================================================
-- DEBUG: Check session data to understand what happened
-- =============================================================================

-- 1. Check the sessions for the user
SELECT 
    id,
    name,
    created_at,
    status,
    point_value
FROM sessions
ORDER BY created_at DESC
LIMIT 5;

-- 2. For a specific session (replace SESSION_ID), check session_players
-- SELECT * FROM session_players WHERE session_id = 'SESSION_ID';

-- 3. Check rounds for that session
-- SELECT id, round_number, multiplier, result, finish_order  
-- FROM rounds WHERE session_id = 'SESSION_ID' ORDER BY round_number;

-- 4. Check round_points for each round - this is where the issue likely is
-- SELECT rp.*, sp.username
-- FROM round_points rp
-- JOIN session_players sp ON rp.player_id = sp.id
-- WHERE rp.round_id IN (SELECT id FROM rounds WHERE session_id = 'SESSION_ID');

-- =============================================================================
-- RECOVERY: Recalculate session_players.session_score from round_points
-- This should fix scores if round_points data is intact
-- =============================================================================

-- For a specific session (replace SESSION_ID with your session ID):
/*
UPDATE session_players sp
SET session_score = COALESCE((
    SELECT SUM(rp.points)
    FROM round_points rp
    JOIN rounds r ON rp.round_id = r.id
    WHERE r.session_id = sp.session_id
    AND rp.player_id = sp.id
), 0)
WHERE sp.session_id = 'SESSION_ID';
*/

-- Verify the update:
-- SELECT username, session_score FROM session_players WHERE session_id = 'SESSION_ID';
