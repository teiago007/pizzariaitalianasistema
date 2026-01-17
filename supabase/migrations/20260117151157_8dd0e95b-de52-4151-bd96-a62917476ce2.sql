-- Create pizza categories table
CREATE TABLE public.pizza_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pizza_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view categories"
ON public.pizza_categories
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage categories"
ON public.pizza_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add category_id to pizza_flavors table
ALTER TABLE public.pizza_flavors
ADD COLUMN category_id UUID REFERENCES public.pizza_categories(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_pizza_categories_updated_at
BEFORE UPDATE ON public.pizza_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();