import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Check, Printer } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useStaff } from "@/contexts/StaffContext";
import { useStore } from "@/contexts/StoreContext";
import type { CartItem, PaymentMethod } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const staffCheckoutSchema = z.object({
  paymentMethod: z.enum(["pix", "cash", "card"]),
  note: z.string().trim().max(500).optional(),
});

const StaffCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useStaff();
  const { settings } = useStore();
  const { items, total, clearCart, itemCount } = useCart();

  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
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

  const buildPrintHtml = (orderId: string, payloadItems: CartItem[], payloadTotal: number) => {
    const fmt = (n: number) => Number(n || 0).toFixed(2);
    const itemsHtml = payloadItems
      .map((item) => {
        if (item.type === "pizza") {
          const pizza = item as any;
          const flavors = (pizza.flavors || []).map((f: any) => f.name).join(" + ") || "Pizza";
          const border = pizza.border?.name ? ` • Borda ${pizza.border.name}` : "";
          const obs = pizza.note ? `<br/><small>Obs: ${String(pizza.note)}</small>` : "";
          return `<div class="item">${pizza.quantity}x Pizza ${flavors} (${pizza.size})${border} - R$ ${fmt(
            pizza.unitPrice * pizza.quantity
          )}${obs}</div>`;
        }
        const p = (item as any).product;
        return `<div class="item">${item.quantity}x ${p?.name || "Produto"} - R$ ${fmt(
          item.unitPrice * item.quantity
        )}</div>`;
      })
      .join("");

    return `
      <html>
        <head>
          <title>Pedido ${orderId.substring(0, 8).toUpperCase()}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 16px; max-width: 320px; }
            h1 { font-size: 18px; text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .info { margin: 8px 0; }
            .item { margin: 6px 0; }
            .total { font-weight: bold; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
            small { color: #333; }
          </style>
        </head>
        <body>
          <h1>🍕 ${settings.name}</h1>
          <div class="info"><strong>Pedido:</strong> ${orderId.substring(0, 8).toUpperCase()}</div>
          <div class="info"><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</div>
          <hr/>
          <div><strong>Itens:</strong></div>
          ${itemsHtml}
          <div class="total">TOTAL: R$ ${fmt(payloadTotal)}</div>
          <div class="info"><strong>Pagamento:</strong> ${paymentMethod.toUpperCase()}</div>
          ${note.trim() ? `<div class="info"><strong>Obs geral:</strong> ${note.trim()}</div>` : ""}
        </body>
      </html>
    `;
  };

  const createOrderInternal = async (opts: { print: boolean }) => {
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
        })
        .select("id")
        .single();

      if (error) throw error;

      const orderId = data.id as string;

      if (opts.print) {
        try {
          const html = buildPrintHtml(orderId, items as CartItem[], total);
          const w = window.open("", "_blank");
          if (!w) throw new Error("Popup bloqueado");
          w.document.write(html);
          w.document.close();
          w.focus();
          w.print();
        } catch (e) {
          console.error(e);
          toast.error("Pedido criado, mas não foi possível imprimir.");
        }
      }

      toast.success("Pedido criado!");
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => createOrderInternal({ print: true })}
            disabled={submitting}
          >
            <Printer className="w-4 h-4 mr-2" />
            Criar pedido e imprimir nota
          </Button>
          <Button size="lg" className="w-full" onClick={() => createOrderInternal({ print: false })} disabled={submitting}>
            <Check className="w-4 h-4 mr-2" />
            Criar pedido
          </Button>
        </div>

        <Button variant="ghost" className="w-full" onClick={() => navigate("/funcionario/carrinho")}>Voltar ao carrinho</Button>
      </div>
    </div>
  );
};

export default StaffCheckoutPage;
