-- Add new role value (must be committed before using it in policies/functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'entregador'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'entregador';
  END IF;
END$$;
