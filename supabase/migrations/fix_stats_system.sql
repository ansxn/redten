-- =============================================================================
-- MIGRATION: Fix Stats Update System
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- PART 1: Recalculate ALL stats from historical data
-- This will reset and recalculate stats for every user based on actual game data
-- =============================================================================

-- First, reset all user_stats to zero
UPDATE public.user_stats SET
    total_rounds_played = 0,
    rounds_won = 0,
    lifetime_earnings = 0,
    sessions_played = 0,
    best_session = 0,
    worst_session = 0,
    first_places = COALESCE(first_places, 0),
    total_placement_sum = COALESCE(total_placement_sum, 0),
    updated_at = NOW();

-- Now recalculate from actual game data
WITH player_round_stats AS (
    -- Get all round-level stats for each player
    SELECT 
        sp.user_id,
        s.point_value,
        sp.session_score,
        s.id as session_id,
        s.status,
        rp.points as round_points,
        r.finish_order,
        array_position(r.finish_order, sp.id::text) as placement
    FROM public.session_players sp
    JOIN public.sessions s ON sp.session_id = s.id
    LEFT JOIN public.rounds r ON r.session_id = s.id
    LEFT JOIN public.round_points rp ON rp.round_id = r.id AND rp.player_id = sp.id
    WHERE sp.user_id IS NOT NULL  -- Only registered users
      AND sp.is_guest = false
),
aggregated_stats AS (
    SELECT 
        user_id,
        -- Count distinct completed sessions
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN session_id END) as sessions_played,
        -- Count all rounds played
        COUNT(round_points) as total_rounds_played,
        -- Count rounds won (positive points)
        COUNT(CASE WHEN round_points > 0 THEN 1 END) as rounds_won,
        -- Count first places
        COUNT(CASE WHEN placement = 1 THEN 1 END) as first_places,
        -- Sum of all placements (for average calculation)
        SUM(COALESCE(placement, 0)) as total_placement_sum
    FROM player_round_stats
    GROUP BY user_id
),
session_earnings AS (
    -- Calculate earnings per session for each user
    SELECT 
        sp.user_id,
        s.id as session_id,
        sp.session_score * s.point_value as earnings
    FROM public.session_players sp
    JOIN public.sessions s ON sp.session_id = s.id
    WHERE sp.user_id IS NOT NULL
      AND sp.is_guest = false
      AND s.status = 'completed'
),
earnings_stats AS (
    SELECT 
        user_id,
        SUM(earnings) as lifetime_earnings,
        MAX(earnings) as best_session,
        MIN(earnings) as worst_session
    FROM session_earnings
    GROUP BY user_id
)
UPDATE public.user_stats us SET
    sessions_played = COALESCE(a.sessions_played, 0),
    total_rounds_played = COALESCE(a.total_rounds_played, 0),
    rounds_won = COALESCE(a.rounds_won, 0),
    first_places = COALESCE(a.first_places, 0),
    total_placement_sum = COALESCE(a.total_placement_sum, 0),
    lifetime_earnings = COALESCE(e.lifetime_earnings, 0),
    best_session = COALESCE(e.best_session, 0),
    worst_session = COALESCE(e.worst_session, 0),
    updated_at = NOW()
FROM aggregated_stats a
LEFT JOIN earnings_stats e ON a.user_id = e.user_id
WHERE us.user_id = a.user_id;

-- =============================================================================
-- PART 2: Create trigger for future stats updates
-- This trigger fires when a session is marked as completed
-- =============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_session_completed ON public.sessions;
DROP FUNCTION IF EXISTS public.handle_session_completed();

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_session_completed()
RETURNS TRIGGER
SECURITY DEFINER  -- This allows the trigger to bypass RLS
SET search_path = public
AS $$
DECLARE
    player_record RECORD;
    player_earnings DECIMAL(10,2);
    round_wins INTEGER;
    first_place_count INTEGER;
    placement_sum INTEGER;
    rounds_count INTEGER;
BEGIN
    -- Only process if status changed to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Loop through all registered players in this session
        FOR player_record IN 
            SELECT 
                sp.user_id,
                sp.id as session_player_id,
                sp.session_score,
                sp.is_guest
            FROM public.session_players sp
            WHERE sp.session_id = NEW.id
              AND sp.user_id IS NOT NULL
              AND sp.is_guest = false
        LOOP
            -- Calculate earnings for this player
            player_earnings := player_record.session_score * NEW.point_value;
            
            -- Count rounds won (positive points)
            SELECT COUNT(*) INTO round_wins
            FROM public.round_points rp
            JOIN public.rounds r ON rp.round_id = r.id
            WHERE r.session_id = NEW.id
              AND rp.player_id = player_record.session_player_id
              AND rp.points > 0;
            
            -- Count first places
            SELECT COUNT(*) INTO first_place_count
            FROM public.rounds r
            WHERE r.session_id = NEW.id
              AND r.finish_order[1] = player_record.session_player_id::text;
            
            -- Sum of placements
            SELECT COALESCE(SUM(
                array_position(r.finish_order, player_record.session_player_id::text)
            ), 0) INTO placement_sum
            FROM public.rounds r
            WHERE r.session_id = NEW.id
              AND player_record.session_player_id::text = ANY(r.finish_order);
            
            -- Count total rounds
            SELECT COUNT(*) INTO rounds_count
            FROM public.rounds r
            WHERE r.session_id = NEW.id;
            
            -- Upsert user_stats
            INSERT INTO public.user_stats (
                user_id, 
                sessions_played, 
                total_rounds_played, 
                rounds_won, 
                lifetime_earnings,
                best_session,
                worst_session,
                first_places,
                total_placement_sum,
                updated_at
            )
            VALUES (
                player_record.user_id,
                1,
                rounds_count,
                round_wins,
                player_earnings,
                player_earnings,
                player_earnings,
                first_place_count,
                placement_sum,
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                sessions_played = user_stats.sessions_played + 1,
                total_rounds_played = user_stats.total_rounds_played + rounds_count,
                rounds_won = user_stats.rounds_won + round_wins,
                lifetime_earnings = user_stats.lifetime_earnings + player_earnings,
                best_session = GREATEST(user_stats.best_session, player_earnings),
                worst_session = LEAST(user_stats.worst_session, player_earnings),
                first_places = COALESCE(user_stats.first_places, 0) + first_place_count,
                total_placement_sum = COALESCE(user_stats.total_placement_sum, 0) + placement_sum,
                updated_at = NOW();
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER on_session_completed
    AFTER UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_session_completed();

-- =============================================================================
-- PART 3: Add missing columns if they don't exist
-- =============================================================================

-- Add first_places column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_stats' AND column_name = 'first_places'
    ) THEN
        ALTER TABLE public.user_stats ADD COLUMN first_places INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add total_placement_sum column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_stats' AND column_name = 'total_placement_sum'
    ) THEN
        ALTER TABLE public.user_stats ADD COLUMN total_placement_sum INTEGER DEFAULT 0;
    END IF;
END $$;

-- =============================================================================
-- Done! Stats are now recalculated and future updates will be automatic.
-- =============================================================================
