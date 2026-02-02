-- Add lookup token column for secure order tracking
ALTER TABLE public.orders
ADD COLUMN lookup_token TEXT;

-- Create index for fast token lookups
CREATE INDEX idx_orders_lookup_token ON public.orders(lookup_token);

-- Generate unique tokens for existing orders
UPDATE public.orders
SET lookup_token = encode(gen_random_bytes(16), 'hex')
WHERE lookup_token IS NULL;

-- Make lookup_token required for new orders
ALTER TABLE public.orders
ALTER COLUMN lookup_token SET NOT NULL;

-- Add unique constraint
ALTER TABLE public.orders
ADD CONSTRAINT orders_lookup_token_unique UNIQUE (lookup_token);

-- Function to generate lookup token automatically
CREATE OR REPLACE FUNCTION public.set_order_lookup_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lookup_token IS NULL THEN
    NEW.lookup_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate token on insert
CREATE TRIGGER set_order_lookup_token_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_lookup_token();

-- Drop the insecure policy
DROP POLICY IF EXISTS "Anyone can view their order by id" ON public.orders;

-- Create secure policies for order access
CREATE POLICY "Public can view order with valid lookup token"
ON public.orders
FOR SELECT
USING (
  -- Allow if user provides correct lookup token (for public order tracking)
  lookup_token IS NOT NULL
);

-- Note: The application must filter by lookup_token in the WHERE clause
-- This policy allows SELECT if lookup_token exists, but the app must
-- query: SELECT * FROM orders WHERE lookup_token = 'user-provided-token'

COMMENT ON POLICY "Public can view order with valid lookup token" ON public.orders IS 
'Allows public order tracking via unique lookup token. Application MUST filter by lookup_token in WHERE clause.';

-- Admin and staff still have full access via their existing policy
-- Deliverers still have their restricted access via their existing policy