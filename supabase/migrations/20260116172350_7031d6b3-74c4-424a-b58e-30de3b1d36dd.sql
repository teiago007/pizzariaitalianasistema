-- Add price columns per pizza size for borders
ALTER TABLE public.pizza_borders 
ADD COLUMN IF NOT EXISTS price_p numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_m numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_gg numeric DEFAULT 0;

-- Update existing borders with size-based pricing (proportional to current price)
UPDATE public.pizza_borders SET 
  price_p = CASE WHEN price > 0 THEN price * 0.6 ELSE 0 END,
  price_m = CASE WHEN price > 0 THEN price * 0.8 ELSE 0 END,
  price_g = CASE WHEN price > 0 THEN price ELSE 0 END,
  price_gg = CASE WHEN price > 0 THEN price * 1.2 ELSE 0 END
WHERE price_p = 0 OR price_p IS NULL;