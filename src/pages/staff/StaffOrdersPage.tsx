import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrders } from "@/hooks/useOrders";
import { useStaff } from "@/contexts/StaffContext";
import { useStore } from "@/contexts/StoreContext";
import { useSettings } from "@/hooks/useSettings";
import type { Order, CartItemPizza } from "@/types";
import { PizzaCard } from "@/components/public/PizzaCard";
import { ProductCard } from "@/components/public/ProductCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
// Impressão removida do módulo do funcionário; apenas Admin imprime via USB.

type DbCategory = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  available: boolean;
};

const parseDrinkSize = (name: string) => {
  const m = (name || '').trim().match(/(\d+[\.,]?\d*)\s*(ml|l)\s*$/i);
  if (!m) return null;
  const value = m[1].replace(',', '.');
  const unit = m[2].toLowerCase();
  return `${value}${unit}`;
};

const stripDrinkSize = (name: string) => (name || '').replace(/\s*(\d+[\.,]?\d*)\s*(ml|l)\s*$/i, '').trim();

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

const StaffOrdersPage: React.FC = () => {
  const { user } = useStaff();
  const ordersQueryOptions = useMemo(() => {
    const userId = user?.id || "00000000-0000-0000-0000-000000000000";
    return {
      orderOrigin: "in_store",
      createdByUserId: userId,
      createdFrom: todayStartISOInTZ(),
      limit: 200,
    };
  }, [user?.id]);

  const { orders: myOrders, loading: loadingOrders } = useOrders(ordersQueryOptions);
  useSettings();
  const { flavors, products, isLoadingFlavors, isLoadingProducts } = useStore();

  const { data: pizzaCategories = [] } = useQuery({
    queryKey: ["pizza-categories-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_categories")
        .select("id,name,description,display_order,available")
        .eq("available", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as DbCategory[];
    },
  });

  const isLoading = isLoadingFlavors || isLoadingProducts;

  const flavorsByCategory = useMemo(() => {
    const sorted = [...flavors].sort((a, b) => a.name.localeCompare(b.name));
    const byId: Record<string, typeof sorted> = {};
    const noCategory: typeof sorted = [];

    for (const f of sorted) {
      if (f.categoryId) (byId[f.categoryId] ||= []).push(f);
      else noCategory.push(f);
    }

    return { byId, noCategory };
  }, [flavors]);

  const productCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const productsByCategory = useMemo(() => {
    const byCat: Record<string, typeof products> = {};
    for (const p of products) (byCat[p.category] ||= []).push(p);
    for (const cat of Object.keys(byCat)) {
      byCat[cat] = [...byCat[cat]].sort((a, b) => a.name.localeCompare(b.name));
    }
    return byCat;
  }, [products]);

  // myOrders já vem filtrado no backend (origem + criador + hoje)

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // (Impressão removida)

  // Impressão agora é feita apenas no Admin (USB).

  const OrderDetailsStaff: React.FC<{ order: Order }> = ({ order }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {typeof order.seqOfDay === "number" && (
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Seq. do dia</p>
            <p className="font-medium font-mono">#{order.seqOfDay}</p>
          </div>
        )}
        {order.tableNumber && (
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Mesa/Comanda</p>
            <p className="font-medium">{order.tableNumber}</p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge variant="outline">{order.status}</Badge>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-2">Itens do Pedido</p>
        <div className="space-y-3">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between items-start p-3 bg-muted/30 rounded-lg">
              <div className="flex-1">
                {item.type === "pizza" ? (
                  <>
                    <p className="font-medium">
                      Pizza {(item as CartItemPizza).size} - {(item as CartItemPizza).flavors.length} sabor(es)
                    </p>
                    <div className="text-sm text-muted-foreground mt-1">
                      {(item as CartItemPizza).flavors.map((f, i) => (
                        <span key={f.id}>
                          {i > 0 && " + "}
                          <span className="font-medium text-foreground">{f.name}</span>
                        </span>
                      ))}
                    </div>
                    {(item as CartItemPizza).border && (
                      <p className="text-sm text-muted-foreground">Borda: {(item as CartItemPizza).border?.name}</p>
                    )}
                    {(item as CartItemPizza).note && (
                      <p className="text-sm text-muted-foreground">
                        Obs: <span className="text-foreground">{(item as CartItemPizza).note}</span>
                      </p>
                    )}
                  </>
                ) : (() => {
                  const p: any = (item as any).product;
                  const isSoda = String(p?.category || '').toLowerCase() === 'refrigerantes';
                  const explicitSize = p?.drinkSizeName as string | null | undefined;
                  const legacySize = parseDrinkSize(String(p?.name || ''));
                  const size = explicitSize || legacySize;
                  const baseName = isSoda
                    ? (explicitSize ? String(p?.name || 'Produto') : legacySize ? stripDrinkSize(String(p?.name || '')) : String(p?.name || 'Produto'))
                    : String(p?.name || 'Produto');
                  return (
                    <div>
                      <p className="font-medium">{baseName}</p>
                      {isSoda && size ? <p className="text-sm text-muted-foreground">{String(size)}</p> : null}
                    </div>
                  );
                })()}
                <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
              </div>
              <p className="font-medium text-primary">R$ {(item.unitPrice * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Pagamento</p>
          <Badge variant="outline">
            {order.payment.method === "pix" ? "PIX" : order.payment.method === "cash" ? "Dinheiro" : "Cartão"}
          </Badge>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-between items-center">
        <p className="font-bold text-lg">Total</p>
        <p className="font-bold text-lg text-primary">R$ {order.total.toFixed(2)}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Atendimento</h1>
            <p className="text-muted-foreground">
              Monte o pedido por aqui (pizzas por categoria e bebidas) e finalize pelo carrinho.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/funcionario/carrinho">
              <Button variant="outline">Ver carrinho</Button>
            </Link>
            <Link to="/funcionario/checkout">
              <Button>Finalizar</Button>
            </Link>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="pizzas" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="pizzas" className="text-base">
              🍕 Pizzas
            </TabsTrigger>
            <TabsTrigger value="bebidas" className="text-base">
              🥤 Bebidas
            </TabsTrigger>
            <TabsTrigger value="meus-pedidos" className="text-base">
              📋 Meus pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pizzas" className="mt-6">
            <div className="space-y-10">
              {pizzaCategories.map((cat) => {
                const list = flavorsByCategory.byId[cat.id] || [];
                if (list.length === 0) return null;
                return (
                  <section key={cat.id} className="space-y-4">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-foreground">{cat.name}</h2>
                      {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {list.map((flavor) => (
                        <PizzaCard key={flavor.id} flavor={flavor} />
                      ))}
                    </div>
                  </section>
                );
              })}

              {flavorsByCategory.noCategory.length > 0 && (
                <section className="space-y-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-foreground">Outras</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {flavorsByCategory.noCategory.map((flavor) => (
                      <PizzaCard key={flavor.id} flavor={flavor} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bebidas" className="mt-6">
            <div className="space-y-10">
              {productCategories.map((cat) => {
                const list = (productsByCategory[cat] || []).filter((p) => p.available);
                if (list.length === 0) return null;
                return (
                  <section key={cat} className="space-y-4">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-foreground">{cat}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {list.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="meus-pedidos" className="mt-6">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : myOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum pedido seu hoje.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-bold text-lg">{order.id.substring(0, 8).toUpperCase()}</span>
                            {typeof order.seqOfDay === "number" && (
                              <Badge variant="outline" className="font-mono">
                                #{order.seqOfDay}
                              </Badge>
                            )}
                            <Badge variant="outline">{order.status}</Badge>
                          </div>
                          {order.tableNumber && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Mesa/Comanda: <span className="font-medium text-foreground">{order.tableNumber}</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>

                        <div className="text-right lg:text-center">
                          <p className="text-2xl font-bold text-primary">R$ {order.total.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Pedido {order.id.substring(0, 8).toUpperCase()}</DialogTitle>
                              </DialogHeader>
                              <OrderDetailsStaff order={order} />
                            </DialogContent>
                          </Dialog>

                          {/* Impressão é feita apenas no Admin (USB) */}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default StaffOrdersPage;
