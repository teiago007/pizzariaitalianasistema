import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NotificationPreferences = {
  notify_pending: boolean;
  notify_confirmed: boolean;
  play_sound: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  notify_pending: false,
  notify_confirmed: true,
  play_sound: false,
};

/**
 * Preferências de notificação por usuário (salvas no backend).
 * - Não cria linha automaticamente ao carregar; cria via upsert ao salvar.
 */
export function useNotificationPreferences(userId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notification-preferences", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationPreferences> => {
      if (!userId) return DEFAULT_PREFS;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("notify_pending, notify_confirmed, play_sound")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_PREFS;

      return {
        notify_pending: Boolean(data.notify_pending),
        notify_confirmed: Boolean(data.notify_confirmed),
        play_sound: Boolean(data.play_sound),
      };
    },
    initialData: DEFAULT_PREFS,
  });

  const saveMutation = useMutation({
    mutationFn: async (prefs: NotificationPreferences) => {
      if (!userId) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: userId,
            notify_pending: Boolean(prefs.notify_pending),
            notify_confirmed: Boolean(prefs.notify_confirmed),
            play_sound: Boolean(prefs.play_sound),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;
      return prefs;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    },
  });

  const save = useCallback(
    async (prefs: NotificationPreferences) => {
      await saveMutation.mutateAsync(prefs);
    },
    [saveMutation]
  );

  return {
    prefs: query.data ?? DEFAULT_PREFS,
    loading: query.isLoading,
    error: query.error,
    save,
    saving: saveMutation.isPending,
    DEFAULT_PREFS,
  };
}
