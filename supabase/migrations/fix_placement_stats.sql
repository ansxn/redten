-- COMPREHENSIVE STATS RECALCULATION
-- This recalculates ALL user stats from scratch based on raw data

-- STEP 1: Reset ALL stats to 0 first
UPDATE user_stats
SET 
    total_rounds_played = 0,
    rounds_won = 0,
    lifetime_earnings = 0,
    total_placement_sum = 0,
    first_places = 0;

-- STEP 2: Recalculate total_rounds_played from round_points
-- A user played a round if they have an entry in round_points
-- Handle both old format (player_id = user_id) and new format (player_id = session_players.id)
UPDATE user_stats us
SET total_rounds_played = COALESCE((
    SELECT COUNT(DISTINCT rp.round_id)
    FROM round_points rp
    LEFT JOIN session_players sp ON rp.player_id = sp.id
    WHERE rp.player_id = us.user_id  -- Old format: player_id IS the user_id (UUID = UUID)
       OR sp.user_id = us.user_id    -- New format: player_id is session_players.id
), 0);

-- STEP 3: Recalculate rounds_won (rounds where points > 0)
UPDATE user_stats us
SET rounds_won = COALESCE((
    SELECT COUNT(*)
    FROM round_points rp
    LEFT JOIN session_players sp ON rp.player_id = sp.id
    WHERE (rp.player_id = us.user_id OR sp.user_id = us.user_id)
    AND rp.points > 0
), 0);

-- STEP 4: Recalculate lifetime_earnings (sum of all points)
UPDATE user_stats us
SET lifetime_earnings = COALESCE((
    SELECT SUM(rp.points)
    FROM round_points rp
    LEFT JOIN session_players sp ON rp.player_id = sp.id
    WHERE rp.player_id = us.user_id OR sp.user_id = us.user_id
), 0);

-- STEP 5: Recalculate placements
-- We need to find the user in each round's finish_order
-- finish_order might contain either session_players.id OR user_id (both as text)
WITH user_placements AS (
    SELECT 
        us.user_id,
        r.id as round_id,
        -- Find position in finish_order
        COALESCE(
            -- Try user_id directly in finish_order (old format)
            (
                SELECT t.pos::int
                FROM unnest(r.finish_order) WITH ORDINALITY AS t(player_id, pos)
                WHERE t.player_id = us.user_id::text
                LIMIT 1
            ),
            -- Try session_players.id in finish_order (new format) 
            (
                SELECT t.pos::int
                FROM unnest(r.finish_order) WITH ORDINALITY AS t(player_id, pos)
                WHERE t.player_id IN (
                    SELECT sp.id::text 
                    FROM session_players sp 
                    WHERE sp.user_id = us.user_id 
                    AND sp.session_id = r.session_id
                )
                LIMIT 1
            ),
            0  -- Not found
        ) as placement
    FROM user_stats us
    CROSS JOIN rounds r
    WHERE r.finish_order IS NOT NULL
    AND array_length(r.finish_order, 1) > 0
    -- Only include rounds where this user actually participated (has round_points)
    AND EXISTS (
        SELECT 1 FROM round_points rp
        LEFT JOIN session_players sp ON rp.player_id = sp.id
        WHERE rp.round_id = r.id
        AND (rp.player_id = us.user_id OR sp.user_id = us.user_id)
    )
),
placement_aggregates AS (
    SELECT 
        user_id,
        SUM(CASE WHEN placement BETWEEN 1 AND 6 THEN placement ELSE 0 END) as total_placement,
        COUNT(*) FILTER (WHERE placement = 1) as first_count
    FROM user_placements
    GROUP BY user_id
)
UPDATE user_stats us
SET 
    total_placement_sum = COALESCE(pa.total_placement, 0),
    first_places = COALESCE(pa.first_count, 0)
FROM placement_aggregates pa
WHERE us.user_id = pa.user_id;

-- STEP 6: Final verification
SELECT 
    p.username,
    us.total_rounds_played,
    us.rounds_won,
    us.lifetime_earnings,
    us.total_placement_sum,
    us.first_places,
    CASE 
        WHEN us.total_rounds_played > 0 
        THEN ROUND(us.total_placement_sum::numeric / us.total_rounds_played, 2) 
        ELSE NULL 
    END as avg_placement,
    CASE 
        WHEN us.total_rounds_played > 0 AND us.total_placement_sum = 0 THEN 'WARNING: no placements'
        WHEN us.total_rounds_played = 0 AND us.total_placement_sum > 0 THEN 'ERROR: orphaned placements'
        WHEN us.total_rounds_played > 0 AND 
             (us.total_placement_sum::numeric / us.total_rounds_played) > 6 THEN 'ERROR: avg > 6'
        ELSE 'OK'
    END as status
FROM user_stats us
JOIN profiles p ON p.id = us.user_id
ORDER BY p.username;
