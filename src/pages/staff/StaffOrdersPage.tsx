import React, { useMemo, useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";
import { useCart } from "@/contexts/CartContext";
import { useStaff } from "@/contexts/StaffContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { PaymentMethod } from "@/types";

const parseDrinkSize = (name: string): string | null => {
  const m = name.match(/\(([^)]+)\)$/);
  if (m?.[1]) return m[1];
  const m2 = name.match(/\b(\d+(?:[.,]\d+)?\s?(?:ml|mL|ML|l|L))\b/);
  return m2?.[1] ?? null;
};

const stripDrinkSize = (name: string): string => {
  return name
    .replace(/\s*\(([^)]+)\)\s*$/, "")
    .replace(/\s*\b\d+(?:[.,]\d+)?\s?(?:ml|mL|ML|l|L)\b\s*$/, "")
    .trim();
};

const StaffOrdersPage: React.FC = () => {
  const { user } = useStaff();
  const { flavors, products, isLoadingFlavors, isLoadingProducts } = useStore();
  const { items, total, addPizza, addProduct, removeItem, updateQuantity, clearCart } = useCart();

  const [tableNumber, setTableNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableProducts = useMemo(() => (products || []).filter((p) => p.available), [products]);
  const availableFlavors = useMemo(() => flavors || [], [flavors]);

  const createInStoreOrder = async () => {
    if (!user?.id) {
      toast.error("Você precisa estar logado");
      return;
    }
    if (items.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }
    if (!tableNumber.trim()) {
      toast.error("Informe a mesa/comanda");
      return;
    }

    setIsSubmitting(true);
    try {
      // Observação: a tabela orders exige campos NOT NULL; para pedido interno usamos valores padronizados.
      const customer = {
        name: `Mesa ${tableNumber.trim()}`,
        phone: "00000000",
        address: `Mesa ${tableNumber.trim()}`,
        complement: "Pedido presencial",
      };

      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_address: customer.address,
          customer_complement: customer.complement,
          items: items as unknown as import("@/integrations/supabase/types").Json,
          payment_method: paymentMethod,
          needs_change: false,
          change_for: null,
          total,
          status: "PENDING" as const,
          order_origin: "in_store",
          table_number: tableNumber.trim(),
          created_by_user_id: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      clearCart();
      setTableNumber("");
      toast.success(`Pedido criado (${data.id.slice(0, 8)})`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao criar pedido");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Novo Pedido (Presencial)</h1>
          <p className="text-muted-foreground">Selecione itens e finalize informando mesa/comanda.</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button disabled={items.length === 0} className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Finalizar ({items.length})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalizar pedido</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Mesa/Comanda</Label>
                <Input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="Ex: 12" className="mt-1.5" />
              </div>

              <div>
                <Label>Pagamento</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="pm-cash" />
                    <Label htmlFor="pm-cash">Dinheiro</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="card" id="pm-card" />
                    <Label htmlFor="pm-card">Cartão</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pm-pix" />
                    <Label htmlFor="pm-pix">Pix</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">R$ {total.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => clearCart()} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Limpar carrinho
              </Button>
              <Button onClick={createInStoreOrder} disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Criar pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pizzas (sabores)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFlavors ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {availableFlavors.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addPizza("M", [f], undefined)}
                      className="text-left rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors"
                    >
                      <p className="font-semibold">{f.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{f.description}</p>
                      <p className="text-sm mt-2">A partir de R$ {Number(f.prices.M).toFixed(2).replace(".", ",")}</p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Obs: no modo funcionário, ao tocar em um sabor adiciona uma pizza tamanho <strong>M</strong> com 1 sabor (MVP).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bebidas e extras</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {availableProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p, 1)}
                      className="text-left rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors"
                    >
                      <p className="font-semibold">{p.name}</p>
                      {p.description ? <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p> : null}
                      <p className="text-sm mt-2">R$ {Number(p.price).toFixed(2).replace(".", ",")}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Carrinho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {item.type === "pizza" ? (
                          <>
                            <p className="font-semibold truncate">Pizza {item.size}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {item.flavors.map((f) => f.name).join(" + ")}
                            </p>
                          </>
                        ) : (
                          (() => {
                            const size = parseDrinkSize(item.product.name);
                            const name = stripDrinkSize(item.product.name);
                            return (
                              <>
                                <p className="font-semibold truncate">{name}</p>
                                {size ? <p className="text-xs text-muted-foreground">{size}</p> : null}
                              </>
                            );
                          })()
                        )}
                        <p className="text-sm mt-1">R$ {Number(item.unitPrice * item.quantity).toFixed(2).replace(".", ",")}</p>
                      </div>

                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removeItem(idx)}
                        aria-label="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateQuantity(idx, item.quantity - 1)}>
                          -
                        </Button>
                        <span className="text-sm w-8 text-center">{item.quantity}</span>
                        <Button variant="outline" size="sm" onClick={() => updateQuantity(idx, item.quantity + 1)}>
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-semibold">R$ {total.toFixed(2).replace(".", ",")}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffOrdersPage;
