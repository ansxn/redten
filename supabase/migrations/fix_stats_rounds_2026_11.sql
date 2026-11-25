-- =============================================================================
-- Stats, round saving and session permission fixes (2026-11)
--
-- 1. recalculate_user_stats is now the ONLY thing that writes user_stats.
--    It derives everything (rounds, wins, losses, first places, placements,
--    earnings, best/worst session in dollars) from raw data.
-- 2. save_round(): one transactional RPC that inserts or edits a round,
--    its red team and its points, updates session scores and then
--    recalculates every registered player's stats. Any session participant
--    (not only the creator) may call it.
-- 3. Stats are also recalculated when a session's status changes, so
--    best/worst session (completed sessions only) stay correct.
-- 4. Fixes the sessions UPDATE policy (sp.session_id = sp.id was always false).
-- 5. Data clean-up: renumbers duplicate round numbers, adds a unique index,
--    relabels rounds that were washes by finish order but saved as wins,
--    backs up user_stats and recalculates everybody.
-- =============================================================================

-- ---------- 0. Backup ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_stats_backup_20261125 AS
  SELECT * FROM public.user_stats;
ALTER TABLE public.user_stats_backup_20261125 ENABLE ROW LEVEL SECURITY;

-- ---------- 1. New columns ----------------------------------------------------
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS rounds_lost INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placement_rounds INTEGER DEFAULT 0;  -- rounds with a known placement (avg placement denominator)

-- ---------- 2. Single source of truth for stats ------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_played INT; v_won INT; v_lost INT;
    v_firsts INT; v_psum INT; v_prounds INT;
    v_earnings NUMERIC; v_sessions INT; v_best NUMERIC; v_worst NUMERIC;
BEGIN
    -- Rounds played / won / lost: one row per round the user has points for
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE t.points > 0),
        COUNT(*) FILTER (WHERE t.points < 0)
    INTO v_played, v_won, v_lost
    FROM (
        SELECT rp.round_id, SUM(rp.points) AS points
        FROM public.round_points rp
        JOIN public.session_players sp ON sp.id = rp.player_id
        WHERE sp.user_id = target_user_id
        GROUP BY rp.round_id
    ) t;

    -- Placements: every round in the user's sessions where they appear in
    -- finish_order (session_players.id, or the auth user id on legacy rows).
    -- placement_rounds is the denominator for average placement.
    SELECT
        COUNT(*) FILTER (WHERE t.pos = 1),
        COALESCE(SUM(t.pos), 0),
        COUNT(*)
    INTO v_firsts, v_psum, v_prounds
    FROM (
        SELECT r.id, MIN(COALESCE(
                   array_position(r.finish_order, sp.id::text),
                   array_position(r.finish_order, sp.user_id::text)
               )) AS pos
        FROM public.rounds r
        JOIN public.session_players sp ON sp.session_id = r.session_id
        WHERE sp.user_id = target_user_id
        GROUP BY r.id
    ) t
    WHERE t.pos IS NOT NULL;

    -- Lifetime earnings in dollars (session_score is the historical source of truth)
    SELECT COALESCE(SUM(sp.session_score * s.point_value), 0)
    INTO v_earnings
    FROM public.session_players sp
    JOIN public.sessions s ON s.id = sp.session_id
    WHERE sp.user_id = target_user_id;

    -- Sessions actually played (at least one round)
    SELECT COUNT(DISTINCT sp.session_id)
    INTO v_sessions
    FROM public.session_players sp
    WHERE sp.user_id = target_user_id
      AND EXISTS (SELECT 1 FROM public.rounds r WHERE r.session_id = sp.session_id);

    -- Best / worst session in dollars, completed sessions only
    SELECT COALESCE(MAX(x.dollars), 0), COALESCE(MIN(x.dollars), 0)
    INTO v_best, v_worst
    FROM (
        SELECT sp.session_id, SUM(sp.session_score * s.point_value) AS dollars
        FROM public.session_players sp
        JOIN public.sessions s ON s.id = sp.session_id
        WHERE sp.user_id = target_user_id
          AND s.status = 'completed'
          AND EXISTS (SELECT 1 FROM public.rounds r WHERE r.session_id = sp.session_id)
        GROUP BY sp.session_id
    ) x;

    INSERT INTO public.user_stats (
        user_id, total_rounds_played, rounds_won, rounds_lost, lifetime_earnings,
        sessions_played, best_session, worst_session,
        first_places, total_placement_sum, placement_rounds, updated_at
    ) VALUES (
        target_user_id, v_played, v_won, v_lost, v_earnings,
        v_sessions, v_best, v_worst,
        v_firsts, v_psum, v_prounds, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_rounds_played = EXCLUDED.total_rounds_played,
        rounds_won          = EXCLUDED.rounds_won,
        rounds_lost         = EXCLUDED.rounds_lost,
        lifetime_earnings   = EXCLUDED.lifetime_earnings,
        sessions_played     = EXCLUDED.sessions_played,
        best_session        = EXCLUDED.best_session,
        worst_session       = EXCLUDED.worst_session,
        first_places        = EXCLUDED.first_places,
        total_placement_sum = EXCLUDED.total_placement_sum,
        placement_rounds    = EXCLUDED.placement_rounds,
        updated_at          = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_session_user_stats(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
    FOR v_uid IN
        SELECT DISTINCT user_id FROM public.session_players
        WHERE session_id = p_session_id AND user_id IS NOT NULL
    LOOP
        PERFORM public.recalculate_user_stats(v_uid);
    END LOOP;
END;
$$;

-- ---------- 3. Transactional round save --------------------------------------
-- p_round_id NULL = new round, otherwise edit that round.
-- p_points: {"<session_players.id>": points, ...}
CREATE OR REPLACE FUNCTION public.save_round(
    p_session_id   uuid,
    p_round_id     uuid,
    p_multiplier   int,
    p_result       text,
    p_finish_order text[],
    p_red_team     uuid[],
    p_points       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session      public.sessions%ROWTYPE;
    v_round_id     uuid;
    v_round_number int;
    v_total        numeric;
BEGIN
    -- Lock the session so concurrent saves serialize (no duplicate round numbers)
    SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF auth.uid() IS NULL OR NOT (
        v_session.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.session_players
                   WHERE session_id = p_session_id AND user_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'You are not a player in this session';
    END IF;

    IF v_session.status <> 'active' THEN
        RAISE EXCEPTION 'Session has already ended';
    END IF;

    -- Every referenced player must belong to this session
    IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(COALESCE(p_points, '{}'::jsonb)) k
        WHERE NOT EXISTS (SELECT 1 FROM public.session_players sp
                          WHERE sp.session_id = p_session_id AND sp.id::text = k)
    ) OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(p_red_team, '{}')) x
        WHERE NOT EXISTS (SELECT 1 FROM public.session_players sp
                          WHERE sp.session_id = p_session_id AND sp.id = x)
    ) OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(p_finish_order, '{}')) x
        WHERE NOT EXISTS (SELECT 1 FROM public.session_players sp
                          WHERE sp.session_id = p_session_id AND sp.id::text = x)
    ) THEN
        RAISE EXCEPTION 'Round references a player who is not in this session';
    END IF;

    SELECT COALESCE(SUM(value::numeric), 0) INTO v_total
    FROM jsonb_each_text(COALESCE(p_points, '{}'::jsonb));
    IF abs(v_total) > 0.001 THEN
        RAISE EXCEPTION 'Round points must add up to zero (got %)', v_total;
    END IF;

    IF p_round_id IS NULL THEN
        SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_round_number
        FROM public.rounds WHERE session_id = p_session_id;

        INSERT INTO public.rounds (session_id, round_number, multiplier, result, finish_order)
        VALUES (p_session_id, v_round_number, p_multiplier, p_result, COALESCE(p_finish_order, '{}'))
        RETURNING id INTO v_round_id;
    ELSE
        SELECT round_number INTO v_round_number
        FROM public.rounds WHERE id = p_round_id AND session_id = p_session_id
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Round not found in this session';
        END IF;
        v_round_id := p_round_id;

        -- Reverse the old points from session scores, then clear the old rows
        UPDATE public.session_players sp
        SET session_score = sp.session_score - o.points
        FROM (SELECT player_id, SUM(points) AS points
              FROM public.round_points WHERE round_id = v_round_id
              GROUP BY player_id) o
        WHERE sp.id = o.player_id;

        DELETE FROM public.round_points   WHERE round_id = v_round_id;
        DELETE FROM public.round_red_team WHERE round_id = v_round_id;

        UPDATE public.rounds
        SET multiplier = p_multiplier, result = p_result,
            finish_order = COALESCE(p_finish_order, '{}')
        WHERE id = v_round_id;
    END IF;

    INSERT INTO public.round_red_team (round_id, player_id)
    SELECT v_round_id, x FROM unnest(COALESCE(p_red_team, '{}')) x;

    INSERT INTO public.round_points (round_id, player_id, points)
    SELECT v_round_id, key::uuid, value::numeric
    FROM jsonb_each_text(COALESCE(p_points, '{}'::jsonb));

    UPDATE public.session_players sp
    SET session_score = sp.session_score + (p_points ->> sp.id::text)::numeric
    WHERE sp.session_id = p_session_id AND p_points ? sp.id::text;

    -- Stats last, after session scores are final
    PERFORM public.recalculate_session_user_stats(p_session_id);

    RETURN jsonb_build_object(
        'round_id', v_round_id,
        'round_number', v_round_number,
        'created_at', (SELECT created_at FROM public.rounds WHERE id = v_round_id),
        'players', (SELECT jsonb_agg(jsonb_build_object('id', id, 'session_score', session_score))
                    FROM public.session_players WHERE session_id = p_session_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_round(uuid, uuid, int, text, text[], uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_round(uuid, uuid, int, text, text[], uuid[], jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.recalculate_session_user_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalculate_user_stats(uuid) FROM PUBLIC, anon;

-- ---------- 4. Recalculate when a session ends / reopens ---------------------
CREATE OR REPLACE FUNCTION public.trigger_recalc_on_session_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM public.recalculate_session_user_stats(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalc_stats_on_session_status ON public.sessions;
CREATE TRIGGER recalc_stats_on_session_status
    AFTER UPDATE OF status ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_on_session_status();

-- The old per-row round_points triggers recalculated before session scores
-- were updated (stale earnings). save_round now recalculates at the end.
DROP TRIGGER IF EXISTS update_stats_on_round_points_insert ON public.round_points;
DROP TRIGGER IF EXISTS update_stats_on_round_points_delete ON public.round_points;

-- ---------- 5. Session UPDATE policy fix -------------------------------------
DROP POLICY IF EXISTS "Session participants can update" ON public.sessions;
CREATE POLICY "Session participants can update" ON public.sessions
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.session_players sp
      WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid()
    )
  );

-- ---------- 6. Data clean-up --------------------------------------------------
-- 6a. Renumber rounds in sessions that have duplicate round numbers
WITH dup_sessions AS (
    SELECT DISTINCT session_id FROM public.rounds
    GROUP BY session_id, round_number HAVING COUNT(*) > 1
), renum AS (
    SELECT r.id, ROW_NUMBER() OVER (PARTITION BY r.session_id ORDER BY r.created_at, r.id) AS rn
    FROM public.rounds r JOIN dup_sessions d ON d.session_id = r.session_id
)
UPDATE public.rounds r SET round_number = renum.rn
FROM renum WHERE r.id = renum.id;

CREATE UNIQUE INDEX IF NOT EXISTS rounds_session_round_number_key
    ON public.rounds (session_id, round_number);

-- 6b. Rounds that were washes by finish order (1st and last on the same team)
--     but saved as red_win/blue_win with no points.
UPDATE public.rounds r
SET result = 'wash'
WHERE r.result <> 'wash'
  AND array_length(r.finish_order, 1) = 6
  AND EXISTS (SELECT 1 FROM public.round_red_team rt WHERE rt.round_id = r.id)
  AND (
        EXISTS (SELECT 1 FROM public.round_red_team rt WHERE rt.round_id = r.id AND rt.player_id::text = r.finish_order[1])
      = EXISTS (SELECT 1 FROM public.round_red_team rt WHERE rt.round_id = r.id AND rt.player_id::text = r.finish_order[6])
  )
  AND NOT EXISTS (SELECT 1 FROM public.round_points rp WHERE rp.round_id = r.id AND rp.points <> 0);

-- 6c. Recalculate every user's stats
DO $$
DECLARE v_uid uuid;
BEGIN
    FOR v_uid IN SELECT user_id FROM public.user_stats LOOP
        PERFORM public.recalculate_user_stats(v_uid);
    END LOOP;
END $$;
