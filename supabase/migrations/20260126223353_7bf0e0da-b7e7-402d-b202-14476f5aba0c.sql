-- Allow deliverers to update orders ONLY to mark as DELIVERED
DROP POLICY IF EXISTS "Deliverers can mark orders delivered" ON public.orders;
CREATE POLICY "Deliverers can mark orders delivered"
ON public.orders
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'entregador'::public.app_role)
  AND status = 'READY'::public.order_status
)
WITH CHECK (
  public.has_role(auth.uid(), 'entregador'::public.app_role)
  AND status = 'DELIVERED'::public.order_status
);

-- Enforce column-level restriction via trigger (RLS can't restrict columns)
CREATE OR REPLACE FUNCTION public.restrict_order_updates_for_deliverer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'entregador'::public.app_role) THEN
    -- Only allow transition READY -> DELIVERED
    IF OLD.status IS DISTINCT FROM 'READY'::public.order_status OR NEW.status IS DISTINCT FROM 'DELIVERED'::public.order_status THEN
      RAISE EXCEPTION 'Entregador só pode marcar pedido como entregue.';
    END IF;

    -- Prevent changing any other fields (allow status + updated_at only)
    IF (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION 'Entregador não pode alterar dados do pedido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_order_updates_for_deliverer ON public.orders;
CREATE TRIGGER trg_restrict_order_updates_for_deliverer
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restrict_order_updates_for_deliverer();
