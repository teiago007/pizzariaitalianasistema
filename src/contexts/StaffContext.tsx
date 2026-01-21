import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface StaffContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

export const useStaff = () => {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used within a StaffProvider");
  return ctx;
};

export const StaffProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);

  const checkStaffRole = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "staff",
      });
      if (error) throw error;
      const ok = data === true;
      setIsStaff(ok);
      return ok;
    } catch (e) {
      console.error("Error checking staff role:", e);
      setIsStaff(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        // While role check runs, keep layout in loading state to avoid redirecting back to /funcionario.
        setIsLoading(true);
        // Never call supabase inside onAuthStateChange without deferring.
        setTimeout(() => checkStaffRole(nextSession.user.id), 0);
      } else {
        setIsStaff(false);
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsLoading(true);
        checkStaffRole(session.user.id);
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
      if (error) return { success: false, error: error.message };
      if (data.user) {
        const ok = await checkStaffRole(data.user.id);
        if (!ok) {
          // Prevent redirect loops: if user is not staff, do not allow entering staff area.
          await supabase.auth.signOut();
          return { success: false, error: "Sem permissão de funcionário" };
        }
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsStaff(false);
  };

  const value = useMemo(
    () => ({
      isAuthenticated: !!user && isStaff,
      isLoading,
      user,
      isStaff,
      login,
      logout,
    }),
    [user, isStaff, isLoading]
  );

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
};
