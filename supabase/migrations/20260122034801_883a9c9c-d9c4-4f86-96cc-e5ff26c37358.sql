-- Add explicit RLS policy to satisfy linter while keeping table locked down

DROP POLICY IF EXISTS "Admins can view order daily counters" ON public.order_daily_counters;

CREATE POLICY "Admins can view order daily counters"
ON public.order_daily_counters
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));