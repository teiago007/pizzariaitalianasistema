-- Fix staff in-store order creation failing RLS WITH CHECK
-- Current policy "Anyone can create orders" requires customer_* fields, which staff in-store flow may not provide.
-- We replace it with a policy that allows either:
--  (A) public/customer orders with required customer fields, OR
--  (B) authenticated staff/admin in-store orders with created_by_user_id = auth.uid().

DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
TO public
WITH CHECK (
  (
    customer_name IS NOT NULL
    AND length(trim(both from customer_name)) >= 2
    AND customer_phone IS NOT NULL
    AND length(trim(both from customer_phone)) >= 8
    AND customer_address IS NOT NULL
    AND length(trim(both from customer_address)) >= 5
    AND total IS NOT NULL
    AND total > 0
    AND items IS NOT NULL
    AND jsonb_typeof(items) = 'array'
  )
  OR
  (
    order_origin = 'in_store'
    AND auth.uid() IS NOT NULL
    AND created_by_user_id = auth.uid()
    AND (has_role(auth.uid(), 'staff'::public.app_role) OR has_role(auth.uid(), 'admin'::public.app_role))
    AND total IS NOT NULL
    AND total > 0
    AND items IS NOT NULL
    AND jsonb_typeof(items) = 'array'
  )
);

-- Optional: ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;