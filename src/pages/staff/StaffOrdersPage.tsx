import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { PizzaCard } from "@/components/public/PizzaCard";
import { ProductCard } from "@/components/public/ProductCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DbCategory = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  available: boolean;
};

const StaffOrdersPage: React.FC = () => {
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
            <Link to="/carrinho">
              <Button variant="outline">Ver carrinho</Button>
            </Link>
            <Link to="/checkout">
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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pizzas" className="text-base">
              🍕 Pizzas
            </TabsTrigger>
            <TabsTrigger value="bebidas" className="text-base">
              🥤 Bebidas
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
        </Tabs>
      )}
    </div>
  );
};

export default StaffOrdersPage;
