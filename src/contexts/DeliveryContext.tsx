import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface DeliveryContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  isDeliverer: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

export const useDelivery = () => {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error("useDelivery must be used within a DeliveryProvider");
  return ctx;
};

export const DeliveryProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeliverer, setIsDeliverer] = useState(false);

  const checkRole = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "entregador",
      });
      if (error) throw error;
      const ok = data === true;
      setIsDeliverer(ok);
      return ok;
    } catch (e) {
      console.error("Error checking deliverer role:", e);
      setIsDeliverer(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setIsLoading(true);
        setTimeout(() => checkRole(nextSession.user.id), 0);
      } else {
        setIsDeliverer(false);
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsLoading(true);
        checkRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (data.user) {
        const ok = await checkRole(data.user.id);
        if (!ok) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setIsDeliverer(false);
          return { success: false, error: "Sem permissão de entregador" };
        }
      } else {
        setIsLoading(false);
        return { success: false, error: "Usuário não encontrado" };
      }

      return { success: true };
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, error: e?.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsDeliverer(false);
  };

  const value = useMemo(
    () => ({
      isAuthenticated: !!user && isDeliverer,
      isLoading,
      user,
      isDeliverer,
      login,
      logout,
    }),
    [user, isDeliverer, isLoading]
  );

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
};
