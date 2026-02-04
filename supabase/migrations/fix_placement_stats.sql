-- Migration: Recalculate ALL placement stats from scratch
-- This is a complete rebuild to fix inconsistent data

-- STEP 1: Debug - First, let's see what data we have
-- Check a sample of finish_order data to understand the ID format
SELECT 
    r.id as round_id,
    r.finish_order,
    array_length(r.finish_order, 1) as finish_order_length
FROM rounds r
WHERE r.finish_order IS NOT NULL
AND array_length(r.finish_order, 1) > 0
LIMIT 5;

-- STEP 2: Check session_players to see both id and user_id formats
SELECT 
    sp.id as session_player_id,
    sp.user_id as auth_user_id,
    sp.username
FROM session_players sp
WHERE sp.user_id IS NOT NULL
LIMIT 5;

-- STEP 3: For each round, check if finish_order contains session_player.id or user_id
-- This will help us understand which format was used
SELECT 
    r.id as round_id,
    p.username,
    sp.id as session_player_id,
    sp.user_id as auth_user_id,
    CASE 
        WHEN sp.id::text = ANY(r.finish_order) THEN 'Found by session_player.id'
        WHEN sp.user_id::text = ANY(r.finish_order) THEN 'Found by user_id'
        ELSE 'Not found'
    END as match_type
FROM rounds r
JOIN sessions s ON r.session_id = s.id
JOIN session_players sp ON sp.session_id = s.id
JOIN profiles p ON p.id = sp.user_id
WHERE r.finish_order IS NOT NULL
AND array_length(r.finish_order, 1) > 0
LIMIT 20;

-- STEP 4: Now calculate placements properly
-- Create a comprehensive view of all placements

-- First, reset stats
UPDATE user_stats
SET 
    total_placement_sum = 0,
    first_places = 0;

-- Calculate placements for each user from each round they participated in
WITH round_placements AS (
    SELECT 
        sp.user_id,
        r.id as round_id,
        COALESCE(
            -- Try to find position by session_players.id
            (
                SELECT t.pos::int
                FROM unnest(r.finish_order) WITH ORDINALITY AS t(player_id, pos)
                WHERE t.player_id = sp.id::text
                LIMIT 1
            ),
            -- Fallback: Try to find position by user_id
            (
                SELECT t.pos::int
                FROM unnest(r.finish_order) WITH ORDINALITY AS t(player_id, pos)
                WHERE t.player_id = sp.user_id::text
                LIMIT 1
            ),
            0
        ) as placement
    FROM session_players sp
    JOIN sessions s ON sp.session_id = s.id
    JOIN rounds r ON r.session_id = s.id
    WHERE sp.user_id IS NOT NULL
    AND r.finish_order IS NOT NULL
    AND array_length(r.finish_order, 1) > 0
),
user_aggregates AS (
    SELECT 
        user_id,
        SUM(CASE WHEN placement BETWEEN 1 AND 6 THEN placement ELSE 0 END) as total_placement,
        COUNT(*) FILTER (WHERE placement = 1) as first_count,
        COUNT(*) FILTER (WHERE placement BETWEEN 1 AND 6) as rounds_with_placement
    FROM round_placements
    GROUP BY user_id
)
UPDATE user_stats us
SET 
    total_placement_sum = COALESCE(ua.total_placement, 0),
    first_places = COALESCE(ua.first_count, 0)
FROM user_aggregates ua
WHERE us.user_id = ua.user_id;

-- STEP 5: Verify results
SELECT 
    p.username,
    us.total_rounds_played,
    us.total_placement_sum,
    us.first_places,
    CASE 
        WHEN us.total_rounds_played > 0 
        THEN ROUND(us.total_placement_sum::numeric / us.total_rounds_played, 2) 
        ELSE 0 
    END as avg_placement,
    CASE 
        WHEN us.total_rounds_played > 0 AND 
             (us.total_placement_sum::numeric / us.total_rounds_played) > 6 
        THEN 'ERROR: avg > 6'
        WHEN us.total_rounds_played > 0 AND us.total_placement_sum = 0
        THEN 'WARNING: rounds but no placements'
        WHEN us.total_rounds_played = 0 AND us.total_placement_sum > 0
        THEN 'WARNING: placements but no rounds'
        ELSE 'OK'
    END as status
FROM user_stats us
JOIN profiles p ON p.id = us.user_id
ORDER BY p.username;
