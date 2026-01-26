-- Add structured address fields for better filtering in deliverer module
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_street text NULL,
  ADD COLUMN IF NOT EXISTS customer_neighborhood text NULL;

-- Helpful indexes for filtering/search (non-unique)
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_neighborhood ON public.orders (customer_neighborhood);
CREATE INDEX IF NOT EXISTS idx_orders_customer_street ON public.orders (customer_street);
