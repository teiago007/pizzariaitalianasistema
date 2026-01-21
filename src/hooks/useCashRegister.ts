import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/contexts/StaffContext";

export type CashMovementType = "SALE" | "SUPPLY" | "WITHDRAW";

export type CashShift = {
  id: string;
  opened_by: string;
  opened_at: string;
  opening_balance: number;
  closed_at: string | null;
  closed_by: string | null;
  closing_balance: number | null;
  note: string | null;
};

export type CashMovement = {
  id: string;
  shift_id: string;
  type: CashMovementType;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
};

export function useCashRegister() {
  const queryClient = useQueryClient();
  const { user } = useStaff();

  const { data: openShift, isLoading: loadingShift } = useQuery({
    queryKey: ["cash-shift-open", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_register_shifts")
        .select("*")
        .eq("opened_by", user!.id)
        .is("closed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CashShift | null) ?? null;
    },
  });

  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ["cash-movements", openShift?.id],
    enabled: !!openShift?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_register_movements")
        .select("*")
        .eq("shift_id", openShift!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CashMovement[]) ?? [];
    },
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["cash-shift-open", user?.id] });
    await queryClient.invalidateQueries({ queryKey: ["cash-movements", openShift?.id] });
  }, [queryClient, user?.id, openShift?.id]);

  const openNewShift = useCallback(
    async (openingBalance: number, note?: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("cash_register_shifts").insert({
        opened_by: user.id,
        opening_balance: openingBalance,
        note: note || null,
      });
      if (error) throw error;
      await refresh();
    },
    [user?.id, refresh]
  );

  const closeShift = useCallback(
    async (closingBalance: number, note?: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!openShift?.id) throw new Error("No open shift");

      const { error } = await supabase
        .from("cash_register_shifts")
        .update({
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          closing_balance: closingBalance,
          note: note ?? openShift.note ?? null,
        })
        .eq("id", openShift.id);
      if (error) throw error;
      await refresh();
    },
    [user?.id, openShift, refresh]
  );

  const addMovement = useCallback(
    async (type: CashMovementType, amount: number, note?: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!openShift?.id) throw new Error("No open shift");

      const { error } = await supabase.from("cash_register_movements").insert({
        shift_id: openShift.id,
        type,
        amount,
        note: note || null,
        created_by: user.id,
      });
      if (error) throw error;
      await refresh();
    },
    [user?.id, openShift?.id, refresh]
  );

  const totals = (movements || []).reduce(
    (acc, m) => {
      if (m.type === "SUPPLY") acc.supplies += Number(m.amount);
      if (m.type === "WITHDRAW") acc.withdraws += Number(m.amount);
      if (m.type === "SALE") acc.sales += Number(m.amount);
      return acc;
    },
    { sales: 0, supplies: 0, withdraws: 0 }
  );

  const computedBalance = (openShift?.opening_balance || 0) + totals.sales + totals.supplies - totals.withdraws;

  return {
    openShift,
    movements: movements || [],
    loading: loadingShift || loadingMovements,
    openNewShift,
    closeShift,
    addMovement,
    totals,
    computedBalance,
  };
}
