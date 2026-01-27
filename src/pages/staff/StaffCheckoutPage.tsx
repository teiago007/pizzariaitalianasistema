import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Bluetooth, Check, Clock, Printer, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useStaff } from "@/contexts/StaffContext";
import { useStore } from "@/contexts/StoreContext";
import { useStoreAvailability } from "@/hooks/useStoreAvailability";
import { useBluetoothEscposPrinter } from "@/hooks/useBluetoothEscposPrinter";
import type { CartItem, PaymentMethod } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const bt = useBluetoothEscposPrinter();
  const showOpenInNewTab = React.useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const openInNewTab = React.useCallback(() => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }, []);

  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paperWidth, setPaperWidth] = useState<"80" | "53">("80");
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

  const buildPrintHtml = (
    orderId: string,
    payloadItems: CartItem[],
    payloadTotal: number,
    meta?: { seqOfDay?: number; tableNumber?: string }
  ) => {
    const fmt = (n: number) => Number(n || 0).toFixed(2);
    const paperMm = paperWidth;
    const hasLogo = Boolean(settings.logo);
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const itemsHtml = payloadItems
      .map((item) => {
        if (item.type === "pizza") {
          const pizza = item as any;
          const flavors = (pizza.flavors || []).map((f: any) => f.name).join(" + ") || "Pizza";
          const border = pizza.border?.name ? ` • Borda ${pizza.border.name}` : "";
          const obs = pizza.note ? `<div class="muted">Obs: ${escapeHtml(String(pizza.note))}</div>` : "";
          return `
            <div class="row">
              <div class="qty">${pizza.quantity}x</div>
              <div class="name">
                <div class="title">Pizza ${escapeHtml(flavors)} (${escapeHtml(String(pizza.size))})</div>
                ${border ? `<div class="muted">${escapeHtml(border.replace(/^\s*•\s*/, ""))}</div>` : ""}
                ${obs}
              </div>
              <div class="price">R$ ${fmt(pizza.unitPrice * pizza.quantity)}</div>
            </div>
          `;
        }
        const p = (item as any).product;
        const productName = escapeHtml(String(p?.name || "Produto"));
        return `
          <div class="row">
            <div class="qty">${item.quantity}x</div>
            <div class="name">
              <div class="title">${productName}</div>
            </div>
            <div class="price">R$ ${fmt(item.unitPrice * item.quantity)}</div>
          </div>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <title>Pedido ${orderId.substring(0, 8).toUpperCase()}</title>
          <style>
            :root {
              --paper: ${paperMm}mm;
              --m: 3mm;
              --font: 11px;
              --font-sm: 10px;
              --font-lg: 14px;
            }

            @page {
              size: var(--paper) auto;
              margin: var(--m);
            }

            html, body {
              width: var(--paper);
              margin: 0;
              padding: 0;
              color: #000;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
              font-size: var(--font);
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .wrap { padding: var(--m); }

            .center { text-align: center; }
            .muted { color: #222; font-size: var(--font-sm); }
            .hr { border-top: 1px dashed #000; margin: 8px 0; }

            .logo {
              display: ${hasLogo ? "block" : "none"};
              width: 100%;
              max-height: 20mm;
              object-fit: contain;
              margin: 0 auto 6px auto;
            }

            .store { font-size: var(--font-lg); font-weight: 700; letter-spacing: 0.5px; }
            .meta { margin-top: 6px; }

            .row {
              display: grid;
              grid-template-columns: 10mm 1fr auto;
              gap: 6px;
              align-items: start;
              margin: 6px 0;
            }
            .qty { font-weight: 700; }
            .title { font-weight: 700; }
            .price { font-weight: 700; white-space: nowrap; text-align: right; }

            .totals {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 2px dashed #000;
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              font-size: var(--font-lg);
              font-weight: 800;
            }

            /* Hide URL/footer where possible */
            a[href]:after { content: ""; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <img class="logo" src="${settings.logo || ""}" alt="Logo" />
            <div class="center store">${escapeHtml(settings.name)}</div>
            <div class="center muted">${escapeHtml(settings.address || "")}</div>

            <div class="hr"></div>
            <div class="meta">
              <div><strong>Pedido:</strong> ${orderId.substring(0, 8).toUpperCase()}</div>
              ${meta?.seqOfDay ? `<div><strong>Seq. do dia:</strong> ${meta.seqOfDay}</div>` : ""}
              ${meta?.tableNumber ? `<div><strong>Mesa/Comanda:</strong> ${escapeHtml(meta.tableNumber)}</div>` : ""}
              <div><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</div>
              <div><strong>Pagamento:</strong> ${escapeHtml(paymentMethod.toUpperCase())}</div>
            </div>

            <div class="hr"></div>
            <div><strong>Itens</strong></div>
            ${itemsHtml}

            <div class="totals">
              <div class="total-line"><span>TOTAL</span><span>R$ ${fmt(payloadTotal)}</span></div>
              ${note.trim() ? `<div class="hr"></div><div><strong>Obs geral:</strong> ${escapeHtml(note.trim())}</div>` : ""}
            </div>

            <div class="hr"></div>
            <div class="center muted">Obrigado!</div>
          </div>
        </body>
      </html>
    `;
  };

  const createOrderInternal = async (opts: { print: boolean }) => {
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
        })
        .select("id, seq_of_day")
        .single();

      if (error) throw error;

      const orderId = data.id as string;

      const seqOfDay = typeof (data as any).seq_of_day === "number" ? (data as any).seq_of_day : undefined;

      if (opts.print) {
        try {
          const html = buildPrintHtml(orderId, items as CartItem[], total, {
            seqOfDay,
            tableNumber: tableNumber.trim() ? tableNumber.trim() : undefined,
          });
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

  const createOrderAndBluetoothPrint58 = async () => {
    if (!bt.isConnected) {
      toast.error("Conecte uma impressora Bluetooth primeiro");
      return;
    }
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
        })
        .select("id, seq_of_day")
        .single();

      if (error) throw error;

      const orderId = data.id as string;
      const seqOfDay = typeof (data as any).seq_of_day === "number" ? (data as any).seq_of_day : undefined;

      await bt.print58mm({
        storeName: String(settings.name || ""),
        storeAddress: settings.address || undefined,
        order: {
          id: orderId,
          createdAt: new Date(),
          seqOfDay,
          tableNumber: tableNumber.trim() ? tableNumber.trim() : undefined,
          items,
          total,
          payment: { method: paymentMethod },
        },
      });

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
            <CardTitle>Impressão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <Label className="text-sm text-muted-foreground">Bluetooth (58mm)</Label>
              <div className="flex flex-wrap items-center gap-2">
                {showOpenInNewTab ? (
                  <Button variant="outline" onClick={openInNewTab}>
                    <ExternalLink className="w-4 h-4" />
                    Abrir em nova aba (impressão)
                  </Button>
                ) : null}
                <Button variant="outline" onClick={bt.connect} disabled={bt.connecting}>
                  <Bluetooth className="w-4 h-4" />
                  {bt.connecting ? "Conectando..." : "Conectar"}
                </Button>
                {bt.isConnected ? (
                  <Button variant="outline" onClick={bt.disconnect}>
                    Desconectar
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  onClick={() => bt.printTest58mm({ storeName: String(settings.name || ""), storeAddress: settings.address || undefined })}
                  disabled={!bt.isConnected}
                  title={bt.isConnected ? "Testar impressão Bluetooth (58mm)" : "Conecte Bluetooth para testar"}
                >
                  <Printer className="w-4 h-4" />
                  Testar impressão
                </Button>
              </div>
            </div>

            <Label className="text-sm text-muted-foreground">Largura do papel</Label>
            <Select value={paperWidth} onValueChange={(v) => setPaperWidth(v as "80" | "53")}> 
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="80">80mm (térmica)</SelectItem>
                <SelectItem value="53">53mm</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Dica: a maioria das impressoras térmicas de balcão é 80mm ou 58mm. Se sua for 58mm e o layout ficar cortando,
              me avise que adiciono a opção 58mm também.
            </p>

            <div className="pt-3">
              <Label htmlFor="staff-table" className="text-sm text-muted-foreground">Mesa/Comanda (opcional)</Label>
              <Input
                id="staff-table"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ex: Mesa 4 / Comanda 12"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Isso aparece no cupom, junto com o <strong>Seq. do dia</strong> (contagem simples).
              </p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => createOrderInternal({ print: true })}
            disabled={submitting || !availability.isOpenNow}
          >
            <Printer className="w-4 h-4 mr-2" />
            Criar pedido e imprimir nota
          </Button>
          <div className="grid gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => createOrderInternal({ print: false })}
              disabled={submitting || !availability.isOpenNow}
            >
              <Check className="w-4 h-4 mr-2" />
              Criar pedido
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={createOrderAndBluetoothPrint58}
              disabled={submitting || !availability.isOpenNow || !bt.isConnected}
              title={bt.isConnected ? "Imprimir via Bluetooth 58mm" : "Conecte Bluetooth para imprimir"}
            >
              <Bluetooth className="w-4 h-4 mr-2" />
              Criar e imprimir (Bluetooth 58mm)
            </Button>
          </div>
        </div>

        <Button variant="ghost" className="w-full" onClick={() => navigate("/funcionario/carrinho")}>Voltar ao carrinho</Button>
      </div>
    </div>
  );
};

export default StaffCheckoutPage;
