import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Contador de pedidos PENDING robusto (usa COUNT no backend, não depende do limite 1000).
 * Atualiza em tempo real quando houver mudanças na tabela orders.
 */
export function usePendingOrdersCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING");

      if (error) throw error;
      setCount(typeof count === "number" ? count : 0);
    } catch (e) {
      console.error("Error fetching pending orders count:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();

    const channel = supabase
      .channel("pending-orders-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          // Simples e confiável: refaz o COUNT.
          void refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { count, loading, refetch };
}
