-- Fix: Allow any session PARTICIPANT to update session status (not just creator)
-- This fixes the bug where non-creators can't end sessions

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Session creators can update" ON public.sessions;

-- New policy: session creator OR any registered participant can update
CREATE POLICY "Session participants can update" ON public.sessions
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.session_players sp
      WHERE sp.session_id = id AND sp.user_id = auth.uid()
    )
  );

-- Also fix any currently stuck sessions
UPDATE sessions SET status = 'completed', updated_at = NOW()
WHERE status = 'active' AND id IN (
  '78b606c6-ea0f-43f4-adbf-1eee80208527',
  '6e3515d0-6fdd-4c76-82e7-d6d68d5707f6',
  '9a73a7e0-44ad-4eb5-923c-023c24a06b61',
  '5cfe313f-d88a-41a0-98b6-3256b7e0aa66',
  '25fbc219-0aef-416e-8f4c-348532bdaf78'
);
