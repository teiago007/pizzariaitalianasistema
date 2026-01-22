-- Robust daily order sequence counter

-- 1) Counter table (one row per local day)
CREATE TABLE IF NOT EXISTS public.order_daily_counters (
  order_date date PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (not used directly by client; trigger/function will update it)
ALTER TABLE public.order_daily_counters ENABLE ROW LEVEL SECURITY;

-- No client access by default (no policies)

-- 2) Function to atomically get next sequence number for a given date
CREATE OR REPLACE FUNCTION public.next_order_seq(p_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.order_daily_counters(order_date, last_seq, updated_at)
  VALUES (p_date, 1, now())
  ON CONFLICT (order_date)
  DO UPDATE
    SET last_seq = public.order_daily_counters.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO v_next;

  RETURN v_next;
END;
$$;

-- 3) Store the sequence on each order
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS seq_of_day integer;

-- 4) Trigger to populate seq_of_day on insert (São Paulo local date)
CREATE OR REPLACE FUNCTION public.set_order_seq_of_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_date date;
BEGIN
  IF NEW.seq_of_day IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  NEW.seq_of_day := public.next_order_seq(v_date);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_seq_of_day ON public.orders;
CREATE TRIGGER trg_set_order_seq_of_day
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_seq_of_day();

-- 5) Helpful index for lookups
CREATE INDEX IF NOT EXISTS idx_orders_seq_of_day_created_at
ON public.orders (created_at DESC, seq_of_day);