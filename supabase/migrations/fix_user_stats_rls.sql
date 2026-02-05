-- FIX: Update RLS policy for user_stats to allow session hosts to update participant stats
-- Current policy only allows users to update their own stats
-- But when a session host adds a round, they need to update everyone's stats

-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;

-- Create new INSERT policy: Allow if user is updating their own stats
-- OR if they're a session host updating stats for a session participant
CREATE POLICY "Can insert user stats" ON public.user_stats
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.session_players sp ON sp.session_id = s.id
      WHERE s.created_by = auth.uid() 
        AND sp.user_id = user_stats.user_id
    )
  );

-- Create new UPDATE policy: Same logic
CREATE POLICY "Can update user stats" ON public.user_stats
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.session_players sp ON sp.session_id = s.id
      WHERE s.created_by = auth.uid() 
        AND sp.user_id = user_stats.user_id
    )
  );
