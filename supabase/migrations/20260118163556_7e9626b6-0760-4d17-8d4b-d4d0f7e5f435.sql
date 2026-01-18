-- Tighten overly permissive INSERT policy on orders
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
WITH CHECK (
  customer_name IS NOT NULL AND length(trim(customer_name)) >= 2
  AND customer_phone IS NOT NULL AND length(trim(customer_phone)) >= 8
  AND customer_address IS NOT NULL AND length(trim(customer_address)) >= 5
  AND total IS NOT NULL AND total > 0
  AND items IS NOT NULL
  AND jsonb_typeof(items) = 'array'
);
