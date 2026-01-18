-- Add fixed prices per size to pizza categories (optional)
ALTER TABLE public.pizza_categories
  ADD COLUMN IF NOT EXISTS price_p numeric NULL,
  ADD COLUMN IF NOT EXISTS price_m numeric NULL,
  ADD COLUMN IF NOT EXISTS price_g numeric NULL,
  ADD COLUMN IF NOT EXISTS price_gg numeric NULL;

-- Helpful indexes for admin filtering
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);
