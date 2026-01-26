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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

const orderFullAddress = (o: Order) => {
  const street = String(o.customer.street || '').trim();
  const number = String((o.customer as any).number || '').trim();
  const neighborhood = String(o.customer.neighborhood || '').trim();
  const base = street ? street + (number ? `, ${number}` : '') + (neighborhood ? ` - ${neighborhood}` : '') : String(o.customer.address || '').trim();
  const complement = String(o.customer.complement || '').trim();
  const reference = String((o.customer as any).reference || '').trim();
  return {
    base,
    complement: complement || undefined,
    reference: reference || undefined,
    mapsQuery: `${base}${complement ? ` ${complement}` : ''}${reference ? ` ${reference}` : ''}`.trim(),
  };
};

const DeliveryOrdersPage: React.FC = () => {
  const { settings } = useSettings();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [streetQuery, setStreetQuery] = useState("");
  const [neighborhoodQuery, setNeighborhoodQuery] = useState("");

  const { orders, loading, refetch } = useOrders({
    status: pendingOnly ? "READY" : (["READY", "DELIVERED"] as const),
    createdFrom: todayStartISOInTZ(),
    limit: 300,
  });
  const [markingId, setMarkingId] = useState<string | null>(null);

  const deliverable = useMemo(() => {
    // Evita mostrar pedidos presenciais (in_store)
    const normalize = (v: string) => String(v || "").trim().toLowerCase();
    const normalizePhone = (v: string) => String(v || "").replace(/\D/g, "");

    const phoneNeedle = normalizePhone(phoneQuery);
    const streetNeedle = normalize(streetQuery);
    const neighNeedle = normalize(neighborhoodQuery);

    return orders
      .filter((o) => o.orderOrigin !== "in_store")
      .filter((o) => {
        if (phoneNeedle) {
          const hay = normalizePhone(o.customer.phone);
          if (!hay.includes(phoneNeedle)) return false;
        }

        if (streetNeedle) {
          const hay = normalize(o.customer.street || o.customer.address);
          if (!hay.includes(streetNeedle)) return false;
        }

        if (neighNeedle) {
          const hay = normalize(o.customer.neighborhood || o.customer.address);
          if (!hay.includes(neighNeedle)) return false;
        }

        return true;
      });
  }, [orders, phoneQuery, streetQuery, neighborhoodQuery]);

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
        <p className="text-muted-foreground">
          Mostrando pedidos de hoje. Modo: <strong>{pendingOnly ? "somente pendentes" : "pendentes + entregues"}</strong>.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
            <Switch id="pendingOnly" checked={pendingOnly} onCheckedChange={(v) => setPendingOnly(Boolean(v))} />
            <Label htmlFor="pendingOnly" className="text-sm">Somente pendentes</Label>
          </div>

          <div>
            <Label htmlFor="phoneSearch" className="text-sm">Buscar telefone</Label>
            <Input
              id="phoneSearch"
              value={phoneQuery}
              onChange={(e) => setPhoneQuery(e.target.value)}
              placeholder="Ex: 9898134..."
              className="mt-1.5"
              inputMode="tel"
            />
          </div>

          <div>
            <Label htmlFor="streetSearch" className="text-sm">Filtrar rua</Label>
            <Input
              id="streetSearch"
              value={streetQuery}
              onChange={(e) => setStreetQuery(e.target.value)}
              placeholder="Ex: Manoel Bezerra"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="neighSearch" className="text-sm">Filtrar bairro</Label>
            <Input
              id="neighSearch"
              value={neighborhoodQuery}
              onChange={(e) => setNeighborhoodQuery(e.target.value)}
              placeholder="Ex: Centro"
              className="mt-1.5"
            />
          </div>
        </div>
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
                  {(() => {
                    const addr = orderFullAddress(o);
                    return (
                      <>
                        <p className="text-foreground">{addr.base || o.customer.address}</p>
                        {addr.complement ? <p className="text-sm text-muted-foreground">{addr.complement}</p> : null}
                        {addr.reference ? <p className="text-sm text-muted-foreground">Ref: {addr.reference}</p> : null}
                      </>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a href={`tel:${o.customer.phone}`}>
                      <Phone className="w-4 h-4" />
                      Ligar
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href={googleMapsUrl(orderFullAddress(o).mapsQuery)}
                      target="_blank"
                      rel="noreferrer"
                    >
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
