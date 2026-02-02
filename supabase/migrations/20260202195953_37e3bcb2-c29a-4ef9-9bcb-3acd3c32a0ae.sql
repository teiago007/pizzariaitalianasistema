-- Add printing workflow fields to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS print_status TEXT,
ADD COLUMN IF NOT EXISTS print_source TEXT,
ADD COLUMN IF NOT EXISTS print_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS print_requested_by UUID,
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS printed_by UUID;

CREATE INDEX IF NOT EXISTS idx_orders_print_status ON public.orders (print_status);
CREATE INDEX IF NOT EXISTS idx_orders_print_requested_at ON public.orders (print_requested_at);

-- Backfill existing rows as printed to avoid clogging the queue
UPDATE public.orders
SET print_status = COALESCE(print_status, 'PRINTED'),
    printed_at = COALESCE(printed_at, created_at)
WHERE print_status IS NULL;
