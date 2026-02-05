-- FIX: Update RLS policy for round_points to allow session participants to insert
-- Current policy only allows session creator, but any player should be able to add points

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Can add round points" ON public.round_points;

-- Create new policy: Allow insert if user is a participant in the session
-- (Either the creator OR a player in the session)
CREATE POLICY "Can add round points" ON public.round_points
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      LEFT JOIN public.session_players sp ON sp.session_id = s.id AND sp.user_id = auth.uid()
      WHERE r.id = round_id 
        AND (s.created_by = auth.uid() OR sp.id IS NOT NULL)
    )
  );

-- Also fix update policy
DROP POLICY IF EXISTS "Can update round points" ON public.round_points;

CREATE POLICY "Can update round points" ON public.round_points
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      LEFT JOIN public.session_players sp ON sp.session_id = s.id AND sp.user_id = auth.uid()
      WHERE r.id = round_id 
        AND (s.created_by = auth.uid() OR sp.id IS NOT NULL)
    )
  );

-- Also fix delete policy
DROP POLICY IF EXISTS "Can delete round points" ON public.round_points;

CREATE POLICY "Can delete round points" ON public.round_points
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      LEFT JOIN public.session_players sp ON sp.session_id = s.id AND sp.user_id = auth.uid()
      WHERE r.id = round_id 
        AND (s.created_by = auth.uid() OR sp.id IS NOT NULL)
    )
  );
