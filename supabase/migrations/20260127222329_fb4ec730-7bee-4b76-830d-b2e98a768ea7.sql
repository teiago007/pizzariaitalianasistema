-- Preferências de notificações do Admin por usuário
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  notify_pending boolean NOT NULL DEFAULT false,
  notify_confirmed boolean NOT NULL DEFAULT true,
  play_sound boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Usuário gerencia suas próprias preferências
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins gerenciam tudo
CREATE POLICY "Admins can manage notification preferences"
ON public.notification_preferences
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice auxiliar
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
  ON public.notification_preferences(user_id);
