-- Store opening hours (weekly)
CREATE TABLE IF NOT EXISTS public.store_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_closed boolean NOT NULL DEFAULT false,
  open_time time without time zone NULL,
  close_time time without time zone NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_hours_day_unique UNIQUE (day_of_week),
  CONSTRAINT store_hours_times_required_when_open CHECK (
    (is_closed = true AND open_time IS NULL AND close_time IS NULL)
    OR (is_closed = false AND open_time IS NOT NULL AND close_time IS NOT NULL)
  )
);

ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view store hours"
ON public.store_hours
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage store hours"
ON public.store_hours
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Store exceptions (date overrides)
CREATE TABLE IF NOT EXISTS public.store_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT true,
  open_time time without time zone NULL,
  close_time time without time zone NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_exceptions_date_unique UNIQUE (exception_date),
  CONSTRAINT store_exceptions_times_required_when_open CHECK (
    (is_closed = true AND open_time IS NULL AND close_time IS NULL)
    OR (is_closed = false AND open_time IS NOT NULL AND close_time IS NOT NULL)
  )
);

ALTER TABLE public.store_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view store exceptions"
ON public.store_exceptions
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage store exceptions"
ON public.store_exceptions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_store_hours_updated_at'
  ) THEN
    CREATE TRIGGER trg_store_hours_updated_at
    BEFORE UPDATE ON public.store_hours
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_store_exceptions_updated_at'
  ) THEN
    CREATE TRIGGER trg_store_exceptions_updated_at
    BEFORE UPDATE ON public.store_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Seed default weekly schedule (America/Sao_Paulo times)
INSERT INTO public.store_hours (day_of_week, is_closed, open_time, close_time)
VALUES
  (0, false, '18:00', '21:40'), -- Sunday
  (1, true,  NULL,    NULL),    -- Monday
  (2, false, '18:00', '21:40'), -- Tuesday
  (3, false, '18:00', '21:40'), -- Wednesday
  (4, false, '18:00', '21:40'), -- Thursday
  (5, false, '18:00', '21:40'), -- Friday
  (6, false, '09:00', '18:00')  -- Saturday
ON CONFLICT (day_of_week) DO NOTHING;
