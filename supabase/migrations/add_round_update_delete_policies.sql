-- Migration: Add missing UPDATE and DELETE policies for round editing
-- Run this in your Supabase SQL Editor to enable round editing functionality

-- ============================================
-- ROUNDS TABLE: Add UPDATE policy
-- ============================================
CREATE POLICY "Session creators can update rounds" ON public.rounds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE id = session_id AND created_by = auth.uid()
    )
  );

-- ============================================
-- ROUND_RED_TEAM TABLE: Add UPDATE and DELETE policies
-- ============================================
CREATE POLICY "Can update round red team" ON public.round_red_team
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      WHERE r.id = round_id AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Can delete round red team" ON public.round_red_team
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      WHERE r.id = round_id AND s.created_by = auth.uid()
    )
  );

-- ============================================
-- ROUND_POINTS TABLE: Add UPDATE and DELETE policies
-- ============================================
CREATE POLICY "Can update round points" ON public.round_points
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      WHERE r.id = round_id AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Can delete round points" ON public.round_points
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      WHERE r.id = round_id AND s.created_by = auth.uid()
    )
  );
