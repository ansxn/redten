-- Migration: Add finish_order column to rounds table
-- Run this in Supabase SQL Editor if you already have data

ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS finish_order TEXT[] DEFAULT '{}';
