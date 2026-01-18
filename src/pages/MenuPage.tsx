import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { PizzaCard } from '@/components/public/PizzaCard';
import { ProductCard } from '@/components/public/ProductCard';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type DbCategory = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  available: boolean;
};

const parseDrinkSize = (name: string) => {
  // Heurística: tenta pegar um sufixo de tamanho no final do nome
  // Exemplos: "Coca-Cola 2L", "Guaraná 350ml", "Fanta 600ml"
  const m = name.trim().match(/(\d+[\.,]?\d*)\s*(ml|l)\s*$/i);
  if (!m) return null;
  const value = m[1].replace(',', '.');
  const unit = m[2].toLowerCase();
  return `${value}${unit}`;
};

const stripDrinkSize = (name: string) => name.replace(/\s*(\d+[\.,]?\d*)\s*(ml|l)\s*$/i, '').trim();

const MenuPage: React.FC = () => {
  const { flavors, products, isLoadingFlavors, isLoadingProducts } = useStore();
  const { addProduct } = useCart();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: pizzaCategories = [] } = useQuery({
    queryKey: ['pizza-categories-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pizza_categories')
        .select('id,name,description,display_order,available')
        .eq('available', true)
        .order('display_order');
      if (error) throw error;
      return (data || []) as DbCategory[];
    },
  });

  const filteredFlavors = flavors.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const productCategories = [...new Set(products.map(p => p.category))];

  const isLoading = isLoadingFlavors || isLoadingProducts;

  const flavorsByCategory = useMemo(() => {
    const byId: Record<string, typeof filteredFlavors> = {};
    const noCategory: typeof filteredFlavors = [];

    for (const f of filteredFlavors) {
      if (f.categoryId) {
        (byId[f.categoryId] ||= []).push(f);
      } else {
        noCategory.push(f);
      }
    }

    return { byId, noCategory };
  }, [filteredFlavors]);

  const refrigerantes = useMemo(() => {
    const items = filteredProducts.filter(p => p.category.toLowerCase() === 'refrigerantes');
    const sizes = new Set<string>();
    const bySize: Record<string, typeof items> = {};

    for (const p of items) {
      const size = parseDrinkSize(p.name) || 'un';
      sizes.add(size);
      (bySize[size] ||= []).push(p);
    }

    const orderedSizes = Array.from(sizes).sort((a, b) => {
      if (a === 'un') return 1;
      if (b === 'un') return -1;
      const toMl = (s: string) => {
        const m = s.match(/(\d+(?:\.\d+)?)(ml|l)/i);
        if (!m) return 0;
        const n = Number(m[1]);
        const u = m[2].toLowerCase();
        return u === 'l' ? n * 1000 : n;
      };
      return toMl(a) - toMl(b);
    });

    orderedSizes.forEach(size => {
      bySize[size] = (bySize[size] || []).sort((a, b) => stripDrinkSize(a.name).localeCompare(stripDrinkSize(b.name)));
    });

    return { items, orderedSizes, bySize };
  }, [filteredProducts]);

  const [selectedSodaSize, setSelectedSodaSize] = useState<string>(() => refrigerantes.orderedSizes[0] || 'un');

  // Se o filtro/busca mudar e o tamanho selecionado não existir mais, volta pro primeiro disponível
  useEffect(() => {
    if (refrigerantes.orderedSizes.length === 0) return;
    if (!refrigerantes.orderedSizes.includes(selectedSodaSize)) {
      setSelectedSodaSize(refrigerantes.orderedSizes[0]);
    }
  }, [refrigerantes.orderedSizes, selectedSodaSize]);

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nosso Cardápio
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Escolha entre nossas deliciosas pizzas artesanais e bebidas
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar no cardápio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pizzas" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="pizzas" className="text-base">
                🍕 Pizzas
              </TabsTrigger>
              <TabsTrigger value="bebidas" className="text-base">
                🥤 Bebidas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pizzas">
              {filteredFlavors.length > 0 ? (
                <div className="space-y-10">
                  {pizzaCategories.map((cat) => {
                    const list = flavorsByCategory.byId[cat.id] || [];
                    if (list.length === 0) return null;
                    return (
                      <section key={cat.id} className="space-y-4">
                        <div className="text-center">
                          <h2 className="font-display text-2xl font-semibold text-foreground">{cat.name}</h2>
                          {cat.description && (
                            <p className="text-muted-foreground max-w-2xl mx-auto">{cat.description}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {list.map((flavor, index) => (
                            <motion.div
                              key={flavor.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                            >
                              <PizzaCard flavor={flavor} />
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    );
                  })}

                  {flavorsByCategory.noCategory.length > 0 && (
                    <section className="space-y-4">
                      <div className="text-center">
                        <h2 className="font-display text-2xl font-semibold text-foreground">Outras</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {flavorsByCategory.noCategory.map((flavor, index) => (
                          <motion.div
                            key={flavor.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <PizzaCard flavor={flavor} />
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma pizza encontrada</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bebidas">
              {/* Refrigerantes: escolher tamanho -> escolher sabor */}
              {refrigerantes.items.length > 0 && (
                <section className="mb-10">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="font-display text-xl font-semibold text-foreground">Refrigerantes</h2>
                    <Badge variant="secondary">Escolha o tamanho e depois o refrigerante</Badge>
                  </div>

                  <Card className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {refrigerantes.orderedSizes.map((size) => (
                          <Button
                            key={size}
                            type="button"
                            variant={selectedSodaSize === size ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedSodaSize(size)}
                          >
                            {size === 'un' ? 'Unidade' : size.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const availableItems = (refrigerantes.bySize[selectedSodaSize] || []).filter((p) => p.available);
                      if (availableItems.length === 0) {
                        return (
                          <div className="col-span-full text-center py-8">
                            <p className="text-muted-foreground">
                              Nenhum refrigerante disponível para este tamanho.
                            </p>
                          </div>
                        );
                      }

                      return availableItems.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <Card className="overflow-hidden h-full">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground truncate">{stripDrinkSize(product.name)}</p>
                                  <p className="text-sm text-muted-foreground">{selectedSodaSize === 'un' ? '' : selectedSodaSize.toUpperCase()}</p>
                                  <p className="text-lg font-bold text-primary mt-1">R$ {product.price.toFixed(2)}</p>
                                </div>
                                <Button onClick={() => addProduct(product)}>
                                  Adicionar
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                         </motion.div>
                      ));
                    })()}
                  </div>
                </section>
              )}

              {productCategories.map((category) => {
                if (category.toLowerCase() === 'refrigerantes') return null;
                const categoryProducts = filteredProducts.filter(p => p.category === category);
                if (categoryProducts.length === 0) return null;

                return (
                  <div key={category} className="mb-8">
                    <h3 className="font-display text-xl font-semibold text-foreground mb-4">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryProducts.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <ProductCard product={product} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum produto encontrado</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default MenuPage;
