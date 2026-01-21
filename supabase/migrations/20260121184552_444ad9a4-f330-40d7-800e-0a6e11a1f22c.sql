-- Cash register: shifts
CREATE TABLE IF NOT EXISTS public.cash_register_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_balance numeric NOT NULL DEFAULT 0,
  closed_at timestamptz NULL,
  closed_by uuid NULL,
  closing_balance numeric NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_register_shifts_opened_by ON public.cash_register_shifts(opened_by);
CREATE INDEX IF NOT EXISTS idx_cash_register_shifts_opened_at ON public.cash_register_shifts(opened_at DESC);

ALTER TABLE public.cash_register_shifts ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_shifts'
      AND policyname = 'Admins can manage cash register shifts'
  ) THEN
    CREATE POLICY "Admins can manage cash register shifts"
    ON public.cash_register_shifts
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Staff: manage only own shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_shifts'
      AND policyname = 'Staff can view own shifts'
  ) THEN
    CREATE POLICY "Staff can view own shifts"
    ON public.cash_register_shifts
    FOR SELECT
    USING (public.has_role(auth.uid(), 'staff'::public.app_role) AND opened_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_shifts'
      AND policyname = 'Staff can create own shifts'
  ) THEN
    CREATE POLICY "Staff can create own shifts"
    ON public.cash_register_shifts
    FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'staff'::public.app_role) AND opened_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_shifts'
      AND policyname = 'Staff can update own shifts'
  ) THEN
    CREATE POLICY "Staff can update own shifts"
    ON public.cash_register_shifts
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'staff'::public.app_role) AND opened_by = auth.uid())
    WITH CHECK (public.has_role(auth.uid(), 'staff'::public.app_role) AND opened_by = auth.uid());
  END IF;
END $$;

-- Cash register: movements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_movement_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.cash_movement_type AS ENUM ('SALE', 'SUPPLY', 'WITHDRAW');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cash_register_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.cash_register_shifts(id) ON DELETE CASCADE,
  type public.cash_movement_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  note text NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_register_movements_shift_id ON public.cash_register_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_movements_created_at ON public.cash_register_movements(created_at DESC);

ALTER TABLE public.cash_register_movements ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_movements'
      AND policyname = 'Admins can manage cash register movements'
  ) THEN
    CREATE POLICY "Admins can manage cash register movements"
    ON public.cash_register_movements
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Staff: can operate movements only for their own shift(s)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_movements'
      AND policyname = 'Staff can view movements of own shifts'
  ) THEN
    CREATE POLICY "Staff can view movements of own shifts"
    ON public.cash_register_movements
    FOR SELECT
    USING (
      public.has_role(auth.uid(), 'staff'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.cash_register_shifts s
        WHERE s.id = cash_register_movements.shift_id
          AND s.opened_by = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_movements'
      AND policyname = 'Staff can create movements for own shifts'
  ) THEN
    CREATE POLICY "Staff can create movements for own shifts"
    ON public.cash_register_movements
    FOR INSERT
    WITH CHECK (
      public.has_role(auth.uid(), 'staff'::public.app_role)
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.cash_register_shifts s
        WHERE s.id = cash_register_movements.shift_id
          AND s.opened_by = auth.uid()
          AND s.closed_at IS NULL
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_movements'
      AND policyname = 'Staff can update movements they created'
  ) THEN
    CREATE POLICY "Staff can update movements they created"
    ON public.cash_register_movements
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'staff'::public.app_role) AND created_by = auth.uid())
    WITH CHECK (public.has_role(auth.uid(), 'staff'::public.app_role) AND created_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_register_movements'
      AND policyname = 'Staff can delete movements they created'
  ) THEN
    CREATE POLICY "Staff can delete movements they created"
    ON public.cash_register_movements
    FOR DELETE
    USING (public.has_role(auth.uid(), 'staff'::public.app_role) AND created_by = auth.uid());
  END IF;
END $$;

-- Timestamps trigger (reuse existing function)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cash_register_shifts_updated_at') THEN
    CREATE TRIGGER update_cash_register_shifts_updated_at
    BEFORE UPDATE ON public.cash_register_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Orders: add optional metadata for in-store ordering
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_origin text NULL,
  ADD COLUMN IF NOT EXISTS table_number text NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_orders_origin ON public.orders(order_origin);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_user_id ON public.orders(created_by_user_id);
