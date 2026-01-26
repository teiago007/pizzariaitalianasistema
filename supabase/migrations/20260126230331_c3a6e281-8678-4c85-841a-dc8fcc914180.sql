-- Add additional structured address fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_number text NULL,
  ADD COLUMN IF NOT EXISTS customer_reference text NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_number ON public.orders (customer_number);
