-- VERIFY: Check current RLS policies on round_points and user_stats

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('round_points', 'user_stats')
ORDER BY tablename, policyname;
