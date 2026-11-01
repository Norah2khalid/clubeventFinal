-- Live participations for the event. The retired submissions table stays untouched.
CREATE TABLE public.participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  student_name text NOT NULL,
  body text NOT NULL,
  section text NOT NULL CHECK (section IN ('problem_1','problem_2','problem_3','problem_4','application','ai_assistant')),
  winner_rank smallint CHECK (winner_rank IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participations_winner_rank_unique UNIQUE (winner_rank)
);

CREATE INDEX participations_created_at_idx ON public.participations (created_at DESC);

REVOKE ALL ON public.participations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.participations TO anon, authenticated;
GRANT DELETE ON public.participations TO authenticated;
GRANT ALL ON public.participations TO service_role;

ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participation reads" ON public.participations
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Participation inserts" ON public.participations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    winner_rank IS NULL
    AND section IN ('problem_1','problem_2','problem_3','problem_4','application','ai_assistant')
    AND char_length(btrim(student_name)) BETWEEN 2 AND 80
    AND char_length(btrim(body)) BETWEEN 1 AND 8000
  );

CREATE POLICY "Organizer participation deletes" ON public.participations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No UPDATE grant and no UPDATE policy. Winner changes go through the function below,
-- which runs as the table owner and still passes the column-freeze trigger.

CREATE OR REPLACE FUNCTION public.participation_title(_body text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  line text;
BEGIN
  FOREACH line IN ARRAY regexp_split_to_array(replace(coalesce(_body, ''), E'\r', ''), E'\n')
  LOOP
    line := btrim(regexp_replace(line, '\s+', ' ', 'g'));
    IF line <> '' THEN
      RETURN left(line, 80);
    END IF;
  END LOOP;
  RETURN '';
END $$;

REVOKE ALL ON FUNCTION public.participation_title(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.prepare_participation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.body := btrim(NEW.body);
    NEW.student_name := btrim(regexp_replace(coalesce(NEW.student_name, ''), '\s+', ' ', 'g'));
    NEW.title := public.participation_title(NEW.body);
    IF char_length(NEW.student_name) < 2 OR char_length(NEW.student_name) > 80
      OR char_length(NEW.body) < 1 OR char_length(NEW.body) > 8000
      OR char_length(NEW.title) < 1 THEN
      RAISE EXCEPTION 'invalid participation' USING ERRCODE = '23514';
    END IF;
    NEW.winner_rank := NULL;
    NEW.created_at := now();
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.title := OLD.title;
  NEW.student_name := OLD.student_name;
  NEW.body := OLD.body;
  NEW.section := OLD.section;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;

CREATE TRIGGER participations_prepare
  BEFORE INSERT OR UPDATE ON public.participations
  FOR EACH ROW EXECUTE FUNCTION public.prepare_participation();

CREATE OR REPLACE FUNCTION public.set_participation_winner(_id uuid, _rank smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF _rank IS NOT NULL AND _rank NOT IN (1, 2) THEN
    RAISE EXCEPTION 'invalid rank' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.participations WHERE id = _id) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
  END IF;

  IF _rank IS NULL THEN
    PERFORM 1 FROM public.participations WHERE id = _id FOR UPDATE;
    UPDATE public.participations SET winner_rank = NULL WHERE id = _id;
    RETURN;
  END IF;

  PERFORM 1 FROM public.participations WHERE id = _id OR winner_rank = _rank FOR UPDATE;
  UPDATE public.participations SET winner_rank = NULL WHERE id = _id OR winner_rank = _rank;
  UPDATE public.participations SET winner_rank = _rank WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.set_participation_winner(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_participation_winner(uuid, smallint) TO authenticated;

COMMENT ON TABLE public.participations IS 'Participant ideas submitted from the event challenges. winner_rank 1 or 2 is organizer-only.';
