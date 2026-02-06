-- CHECK: Verify round_points saved for the MOST RECENT session (any status)

-- 1. Most recent session summary
SELECT 
    s.id as session_id,
    s.name,
    s.status,
    s.created_at,
    COUNT(DISTINCT r.id) as round_count,
    COUNT(rp.id) as total_round_points,
    CASE 
        WHEN COUNT(rp.id) > 0 THEN '✅ WORKING - ' || COUNT(rp.id) || ' points saved'
        WHEN COUNT(r.id) = 0 THEN '⏳ No rounds yet'
        ELSE '❌ BROKEN - ' || COUNT(r.id) || ' rounds but 0 points saved'
    END as status_check
FROM sessions s
LEFT JOIN rounds r ON r.session_id = s.id
LEFT JOIN round_points rp ON rp.round_id = r.id
WHERE s.created_at = (SELECT MAX(created_at) FROM sessions)
GROUP BY s.id, s.name, s.status, s.created_at;

-- 2. Round-by-round breakdown for the most recent session
SELECT 
    r.round_number,
    COUNT(rp.id) as points_saved,
    CASE 
        WHEN COUNT(rp.id) >= 5 THEN '✅'
        WHEN COUNT(rp.id) > 0 THEN '⚠️'
        ELSE '❌'
    END as status
FROM sessions s
JOIN rounds r ON r.session_id = s.id
LEFT JOIN round_points rp ON rp.round_id = r.id
WHERE s.created_at = (SELECT MAX(created_at) FROM sessions)
GROUP BY r.round_number
ORDER BY r.round_number;
