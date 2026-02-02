import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useStaff } from "@/contexts/StaffContext";
import { useStore } from "@/contexts/StoreContext";
import { useStoreAvailability } from "@/hooks/useStoreAvailability";
import type { PaymentMethod } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const staffCheckoutSchema = z.object({
  paymentMethod: z.enum(["pix", "cash", "card"]),
  note: z.string().trim().max(500).optional(),
});

const formatNextOpenShort = (nextOpenAt?: { date: string; time: string }) => {
  if (!nextOpenAt) return undefined;
  const d = new Date(`${nextOpenAt.date}T00:00:00-03:00`);
  const dayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(d);
  return `${dayLabel} ${nextOpenAt.time}`;
};

const parseDrinkSize = (name: string) => {
  const m = (name || '').trim().match(/(\d+[\.,]?\d*)\s*(ml|l)\s*$/i);
  if (!m) return null;
  const value = m[1].replace(',', '.');
  const unit = m[2].toLowerCase();
  return `${value}${unit}`;
};

const stripDrinkSize = (name: string) => (name || '').replace(/\s*(\d+[\.,]?\d*)\s*(ml|l)\s*$/i, '').trim();

const isSodaProduct = (p: { category?: string; name?: string }) => {
  const c = String(p.category || '').toLowerCase();
  const n = String(p.name || '').toLowerCase();
  return c === 'refrigerantes' || n.includes('refrigerante');
};

const hasInvalidSodaInCart = (items: any[]) => {
  return items.some((it) => {
    if (!it || it.type !== 'product') return false;
    const product = (it as any).product;
    if (!product || !isSodaProduct(product)) return false;

    const explicitSize = (product as any).drinkSizeName as string | null | undefined;
    const legacySize = parseDrinkSize(String(product.name || ''));
    const sizeOk = Boolean(explicitSize || legacySize);

    const base = explicitSize
      ? String(product.name || '')
      : legacySize
        ? stripDrinkSize(String(product.name || ''))
        : String(product.name || '');
    const genericName = base.toLowerCase().includes('refrigerante');
    return !sizeOk || genericName;
  });
};

const StaffCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useStaff();
  const { settings } = useStore();
  const { availability } = useStoreAvailability(settings.isOpen);
  const { items, total, clearCart, itemCount } = useCart();

  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const hasItems = items.length > 0;

  const orderSummary = useMemo(() => {
    const pizzas = items.filter((i) => i.type === "pizza").length;
    const products = items.filter((i) => i.type === "product").length;
    return { pizzas, products };
  }, [items]);

  if (!hasItems) {
    // no cart in staff checkout -> go back to staff home
    navigate("/funcionario/pedidos", { replace: true });
    return null;
  }

  const createOrderInternal = async () => {
    if (!availability.isOpenNow) {
      const nextOpen = formatNextOpenShort(availability.nextOpenAt);
      toast.error(nextOpen ? `Loja fechada. Próxima abertura: ${nextOpen}.` : "Loja fechada no momento.");
      return;
    }

    if (hasInvalidSodaInCart(items as any[])) {
      toast.error('Escolha o refrigerante específico antes de criar o pedido (volte ao carrinho e ajuste).');
      navigate('/funcionario/carrinho');
      return;
    }

    const parsed = staffCheckoutSchema.safeParse({ note, paymentMethod });
    if (!parsed.success) {
      toast.error("Verifique os dados do pedido");
      return;
    }

    if (!user?.id) {
      toast.error("Sessão do funcionário não encontrada");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_name: "Atendimento",
           // Keep a valid placeholder to satisfy any public validations/policies.
           // Real staff orders are identified via order_origin='in_store' + created_by_user_id.
           customer_phone: "0000000000",
          customer_address: "Balcão",
          customer_complement: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
          items: items as unknown as import("@/integrations/supabase/types").Json,
          payment_method: parsed.data.paymentMethod,
          needs_change: false,
          change_for: null,
          total,
          status: "CONFIRMED",
          order_origin: "in_store",
          created_by_user_id: user.id,
          table_number: tableNumber.trim() ? tableNumber.trim() : null,
          // Envia para o Admin imprimir
          print_status: "PENDING",
          print_source: "staff",
          print_requested_at: new Date().toISOString(),
          print_requested_by: user.id,
        })
        .select("id, seq_of_day")
        .single();

      if (error) throw error;

      const orderId = data.id as string;

      toast.success("Pedido enviado para o Admin imprimir!");
      clearCart();
      sessionStorage.removeItem("customerInfo");
      navigate("/funcionario/pedidos", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Finalizar (Funcionário)</h1>
          <p className="text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "itens"} • {orderSummary.pizzas} pizza(s) • {orderSummary.products} bebida(s)
          </p>
        </div>

        {!availability.isOpenNow && (
          <div className="p-4 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground flex items-start gap-3">
            <Clock className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Loja fechada no momento</p>
              <p>
                {formatNextOpenShort(availability.nextOpenAt)
                  ? `Voltamos a aceitar pedidos em: ${formatNextOpenShort(availability.nextOpenAt)}.`
                  : "Voltaremos a aceitar pedidos em breve."}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Envio para impressão (Admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este pedido será enviado para o Admin e a impressão será feita na impressora térmica USB.
            </p>

            <div>
              <Label htmlFor="staff-table" className="text-sm text-muted-foreground">
                Mesa/Comanda (opcional)
              </Label>
              <Input
                id="staff-table"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ex: Mesa 4 / Comanda 12"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observação geral (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="staff-note" className="text-sm text-muted-foreground">
              Ex: retirar cebola, entregar no balcão, etc.
            </Label>
            <Textarea
              id="staff-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Digite aqui..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="space-y-3">
              {(
                [
                  { id: "pix", label: "PIX" },
                  { id: "cash", label: "Dinheiro" },
                  { id: "card", label: "Cartão" },
                ] as const
              ).map((opt) => (
                <div key={opt.id}>
                  <RadioGroupItem value={opt.id} id={`staff-pay-${opt.id}`} className="peer sr-only" />
                  <Label
                    htmlFor={`staff-pay-${opt.id}`}
                    className="flex items-center justify-between gap-3 p-4 border rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="font-semibold text-primary">R$ {Number(total || 0).toFixed(2)}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={createOrderInternal}
            disabled={submitting || !availability.isOpenNow}
          >
            <Check className="w-4 h-4 mr-2" />
            Finalizar e enviar para o Admin
          </Button>
        </div>

        <Button variant="ghost" className="w-full" onClick={() => navigate("/funcionario/carrinho")}>Voltar ao carrinho</Button>
      </div>
    </div>
  );
};

export default StaffCheckoutPage;
