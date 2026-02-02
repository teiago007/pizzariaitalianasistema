-- Secure orders table: remove public SELECT and add role-based access

-- 1) Drop the existing public SELECT policy
DROP POLICY IF EXISTS "Public can view order with valid lookup token" ON public.orders;

-- 2) Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Allow staff to view all orders
CREATE POLICY "Staff can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role));