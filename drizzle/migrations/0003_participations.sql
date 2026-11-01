-- Participations for the event. submissions, barcodes, roles, and storage stay untouched.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.participations') IS NOT NULL THEN
    RAISE EXCEPTION 'public.participations already exists; stopped without changes';
  END IF;
  IF to_regclass('public.event_organizer') IS NOT NULL THEN
    RAISE EXCEPTION 'public.event_organizer already exists; stopped without changes';
  END IF;
  IF to_regprocedure('public.set_participation_winner(uuid,smallint)') IS NOT NULL
     OR to_regprocedure('public.set_participation_winner(uuid,smallint,text)') IS NOT NULL
     OR to_regprocedure('public.delete_participation(uuid,text)') IS NOT NULL
     OR to_regprocedure('public.prepare_participation()') IS NOT NULL
     OR to_regprocedure('public.participation_title(text)') IS NOT NULL
     OR to_regprocedure('public.organizer_code_matches(text)') IS NOT NULL
     OR to_regprocedure('public.organizer_authorized(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'participation function already exists; stopped without changes';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  student_name text NOT NULL,
  body text NOT NULL,
  section text NOT NULL CHECK (section IN ('problem_1','problem_2','problem_3','problem_4','application','ai_assistant')),
  delete_code_hash text NOT NULL,
  winner_rank smallint CHECK (winner_rank IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participations_winner_rank_unique UNIQUE (winner_rank)
);

CREATE INDEX participations_created_at_idx ON public.participations (created_at DESC);

REVOKE ALL ON public.participations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, title, student_name, body, section, winner_rank, created_at)
  ON public.participations TO anon, authenticated;
GRANT INSERT (title, student_name, body, section, delete_code_hash)
  ON public.participations TO anon, authenticated;
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
    AND char_length(btrim(title)) BETWEEN 2 AND 80
    AND char_length(btrim(body)) BETWEEN 1 AND 8000
    AND delete_code_hash ~ '^[0-9a-f]{64}$'
  );

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

REVOKE ALL ON FUNCTION public.participation_title(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_participation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.body := btrim(NEW.body);
    NEW.student_name := btrim(regexp_replace(coalesce(NEW.student_name, ''), '\s+', ' ', 'g'));
    NEW.title := btrim(regexp_replace(coalesce(NEW.title, ''), '\s+', ' ', 'g'));
    NEW.delete_code_hash := lower(btrim(coalesce(NEW.delete_code_hash, '')));
    IF char_length(NEW.student_name) < 2 OR char_length(NEW.student_name) > 80
      OR char_length(NEW.title) < 2 OR char_length(NEW.title) > 80
      OR char_length(NEW.body) < 1 OR char_length(NEW.body) > 8000
      OR NEW.delete_code_hash !~ '^[0-9a-f]{64}$' THEN
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
  NEW.delete_code_hash := OLD.delete_code_hash;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.prepare_participation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER participations_prepare
  BEFORE INSERT OR UPDATE ON public.participations
  FOR EACH ROW EXECUTE FUNCTION public.prepare_participation();

CREATE TABLE public.event_organizer (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

REVOKE ALL ON public.event_organizer FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.event_organizer TO service_role;
ALTER TABLE public.event_organizer ENABLE ROW LEVEL SECURITY;

INSERT INTO public.event_organizer (code_hash)
VALUES ('be265a5e393510356678b29e4b9a434a93e1bf0421341dcad211482f90eef9b7');

CREATE OR REPLACE FUNCTION public.organizer_code_matches(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  normalized text;
  stored text;
BEGIN
  normalized := lower(regexp_replace(coalesce(_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  IF char_length(normalized) < 16 OR char_length(normalized) > 64 THEN
    RETURN false;
  END IF;

  SELECT code_hash INTO stored FROM public.event_organizer LIMIT 1;
  IF stored IS NULL THEN
    RETURN false;
  END IF;

  RETURN stored = encode(extensions.digest(convert_to(normalized, 'UTF8'), 'sha256'), 'hex');
END $$;

REVOKE ALL ON FUNCTION public.organizer_code_matches(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.organizer_authorized(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.organizer_code_matches(_code);
END $$;

REVOKE ALL ON FUNCTION public.organizer_authorized(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizer_authorized(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_participation_winner(_id uuid, _rank smallint, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organizer_code_matches(_code) THEN
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

REVOKE ALL ON FUNCTION public.set_participation_winner(uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_participation_winner(uuid, smallint, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_participation(_id uuid, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  normalized text;
  stored text;
BEGIN
  normalized := lower(regexp_replace(coalesce(_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  IF char_length(normalized) < 16 OR char_length(normalized) > 64 THEN
    RETURN false;
  END IF;

  SELECT delete_code_hash INTO stored
  FROM public.participations
  WHERE id = _id;

  IF stored IS NULL
     OR stored <> encode(extensions.digest(convert_to(normalized, 'UTF8'), 'sha256'), 'hex') THEN
    RETURN false;
  END IF;

  DELETE FROM public.participations WHERE id = _id AND delete_code_hash = stored;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.delete_participation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_participation(uuid, text) TO anon, authenticated;

COMMENT ON TABLE public.participations IS 'Participant ideas. delete_code_hash is a SHA-256 digest and is not readable by visitors.';
COMMENT ON TABLE public.event_organizer IS 'SHA-256 digest of the event organizer code. Not readable by visitors. Promotion does not use auth.uid or user_roles.';

NOTIFY pgrst, 'reload schema';

COMMIT;
