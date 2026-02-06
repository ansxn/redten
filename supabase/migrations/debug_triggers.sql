-- CRITICAL: Find and check all triggers that might update user_stats

-- 1. List ALL triggers on sessions table (for session completion)
SELECT 
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event_type,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 2. List ALL functions in the database
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND prosrc ILIKE '%user_stats%'
ORDER BY proname;

-- 3. Check for session-related triggers specifically
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition  
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND (prosrc ILIKE '%session%' OR prosrc ILIKE '%lifetime%')
ORDER BY proname;
