import React, { useMemo, useState } from "react";
import { ExternalLink, Loader2, MapPin, Phone, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrders } from "@/hooks/useOrders";
import { useSettings } from "@/hooks/useSettings";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TZ = "America/Sao_Paulo";

const todayStartISOInTZ = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dateISO = `${map.year}-${map.month}-${map.day}`;
  return `${dateISO}T00:00:00-03:00`;
};

const googleMapsUrl = (address: string) => {
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
};

const DeliveryOrdersPage: React.FC = () => {
  const { settings } = useSettings();
  const { orders, loading, refetch } = useOrders({
    status: "READY",
    createdFrom: todayStartISOInTZ(),
    limit: 300,
  });
  const [markingId, setMarkingId] = useState<string | null>(null);

  const deliverable = useMemo(() => {
    // Evita mostrar pedidos presenciais (in_store)
    return orders.filter((o) => o.orderOrigin !== "in_store");
  }, [orders]);

  const markDelivered = async (order: Order) => {
    setMarkingId(order.id);
    try {
      const { error } = await supabase.from("orders").update({ status: "DELIVERED" }).eq("id", order.id);
      if (error) throw error;
      toast.success("Pedido marcado como entregue");
      await refetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao atualizar pedido");
    } finally {
      setMarkingId(null);
    }
  };

  const paymentLabel = (m: any) => (m === "pix" ? "PIX" : m === "cash" ? "Dinheiro" : "Cartão");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-foreground">Pedidos prontos</h1>
        <p className="text-muted-foreground">Mostrando pedidos com status <strong>READY</strong> de hoje.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : deliverable.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum pedido pronto para entrega agora.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deliverable.map((o) => (
            <Card key={o.id} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">
                        Pedido {typeof o.seqOfDay === "number" ? `#${o.seqOfDay}` : o.id.slice(0, 8).toUpperCase()}
                      </p>
                      <Badge variant="outline">{paymentLabel(o.payment.method)}</Badge>
                      <Badge className="bg-secondary text-secondary-foreground">Pronto</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString("pt-BR")} • Total: <span className="font-medium text-foreground">R$ {o.total.toFixed(2)}</span>
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => refetch()}>
                    Atualizar
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium text-foreground">{o.customer.name}</p>
                    <p className="text-sm text-muted-foreground">{o.customer.phone}</p>
                  </div>
                  <div className="sm:col-span-1">
                    <p className="text-sm text-muted-foreground">Loja</p>
                    <p className="text-sm text-foreground">{settings.name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="text-foreground">{o.customer.address}</p>
                  {o.customer.complement ? <p className="text-sm text-muted-foreground">{o.customer.complement}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a href={`tel:${o.customer.phone}`}>
                      <Phone className="w-4 h-4" />
                      Ligar
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={googleMapsUrl(`${o.customer.address} ${o.customer.complement || ""}`.trim())} target="_blank" rel="noreferrer">
                      <MapPin className="w-4 h-4" />
                      Abrir mapa
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button onClick={() => markDelivered(o)} disabled={markingId === o.id}>
                    <CheckCircle className="w-4 h-4" />
                    {markingId === o.id ? "Salvando..." : "Marcar entregue"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryOrdersPage;
