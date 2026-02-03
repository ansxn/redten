-- =============================================================================
-- INVESTIGATE: What player_ids ARE stored in round_points for these users' sessions?
-- =============================================================================

-- 1. For each affected user, show their session_players.id and the actual player_ids in round_points for their sessions
SELECT 
    p.username,
    sp.id as their_session_player_id,
    sp.session_id,
    rp.player_id as stored_player_id_in_round_points,
    rp.points,
    CASE WHEN sp.id = rp.player_id THEN 'MATCH' ELSE 'MISMATCH' END as status
FROM public.session_players sp
JOIN public.profiles p ON sp.user_id = p.id
JOIN public.rounds r ON r.session_id = sp.session_id
JOIN public.round_points rp ON rp.round_id = r.id
WHERE p.username IN ('MJ', 'Alexia10', 'linlaw', 'cath')
ORDER BY p.username, sp.session_id, r.round_number
LIMIT 50;

-- 2. Show what the stored player_ids look like vs session_players ids
SELECT 
    'round_points.player_id' as source,
    rp.player_id as id_value,
    LENGTH(rp.player_id::text) as len
FROM public.round_points rp
JOIN public.rounds r ON rp.round_id = r.id
JOIN public.session_players sp ON sp.session_id = r.session_id
JOIN public.profiles p ON sp.user_id = p.id
WHERE p.username = 'Alexia10'
LIMIT 10;

-- 3. Check if maybe round_points uses session_players.user_id instead of id
SELECT 
    p.username,
    sp.id as sp_id,
    sp.user_id as sp_user_id,
    rp.player_id,
    CASE WHEN sp.user_id::text = rp.player_id::text THEN 'MATCH ON USER_ID' 
         WHEN sp.id::text = rp.player_id::text THEN 'MATCH ON ID'
         ELSE 'NO MATCH' END as match_type,
    rp.points
FROM public.session_players sp
JOIN public.profiles p ON sp.user_id = p.id
JOIN public.rounds r ON r.session_id = sp.session_id
JOIN public.round_points rp ON rp.round_id = r.id
WHERE p.username IN ('MJ', 'Alexia10', 'linlaw', 'cath')
LIMIT 30;

-- 4. Count how many round_points would match if we used user_id instead of session_players.id
SELECT 
    p.username,
    COUNT(*) FILTER (WHERE rp.points > 0) as positive_if_using_user_id
FROM public.session_players sp
JOIN public.profiles p ON sp.user_id = p.id
JOIN public.rounds r ON r.session_id = sp.session_id
JOIN public.round_points rp ON rp.round_id = r.id AND rp.player_id = sp.user_id  -- Try matching on user_id!
WHERE p.username IN ('MJ', 'Alexia10', 'linlaw', 'cath')
GROUP BY p.username;
