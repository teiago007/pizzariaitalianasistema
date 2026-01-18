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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [pizzaCategoryFilter, setPizzaCategoryFilter] = useState<'__all__' | '__none__' | string>('__all__');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'__all__' | string>('__all__');
  const [onlyAvailableProducts, setOnlyAvailableProducts] = useState(true);
  const [productSort, setProductSort] = useState<'name_asc' | 'price_asc' | 'price_desc'>('name_asc');

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

  const q = searchTerm.toLowerCase();

  const filteredFlavors = useMemo(() => {
    const list = flavors.filter(
      (f) => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
    );
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [flavors, q]);

  const filteredProducts = useMemo(() => {
    let list = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );

    if (productCategoryFilter !== '__all__') {
      list = list.filter((p) => p.category === productCategoryFilter);
    }

    if (onlyAvailableProducts) {
      list = list.filter((p) => p.available);
    }

    const byName = (a: any, b: any) => a.name.localeCompare(b.name);
    if (productSort === 'name_asc') list = [...list].sort(byName);
    if (productSort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price || byName(a, b));
    if (productSort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price || byName(a, b));

    return list;
  }, [products, q, productCategoryFilter, onlyAvailableProducts, productSort]);

  const productCategories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

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
    const items = filteredProducts.filter((p) => p.category.toLowerCase() === 'refrigerantes');
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

    orderedSizes.forEach((size) => {
      bySize[size] = (bySize[size] || []).sort((a, b) => stripDrinkSize(a.name).localeCompare(stripDrinkSize(b.name)));
    });

    return { items, orderedSizes, bySize };
  }, [filteredProducts]);

  const [selectedSodaSize, setSelectedSodaSize] = useState<string | null>(null);

  // Se o filtro/busca mudar e o tamanho selecionado não existir mais, limpa a seleção
  useEffect(() => {
    if (selectedSodaSize === null) return;
    if (!refrigerantes.orderedSizes.includes(selectedSodaSize)) {
      setSelectedSodaSize(null);
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
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pizzaCategoryFilter === '__all__' ? 'default' : 'outline'}
                  onClick={() => setPizzaCategoryFilter('__all__')}
                >
                  Todas
                </Button>
                {pizzaCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    type="button"
                    size="sm"
                    variant={pizzaCategoryFilter === cat.id ? 'default' : 'outline'}
                    onClick={() => setPizzaCategoryFilter(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={pizzaCategoryFilter === '__none__' ? 'default' : 'outline'}
                  onClick={() => setPizzaCategoryFilter('__none__')}
                >
                  Sem categoria
                </Button>
              </div>

              {filteredFlavors.length > 0 ? (
                <div className="space-y-10">
                  {pizzaCategories.map((cat) => {
                    if (pizzaCategoryFilter === '__none__') return null;
                    if (pizzaCategoryFilter !== '__all__' && pizzaCategoryFilter !== cat.id) return null;

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

                  {(pizzaCategoryFilter === '__all__' || pizzaCategoryFilter === '__none__') &&
                    flavorsByCategory.noCategory.length > 0 && (
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
              <div className="mb-6 space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={productCategoryFilter === '__all__' ? 'default' : 'outline'}
                    onClick={() => setProductCategoryFilter('__all__')}
                  >
                    Todas
                  </Button>
                  {productCategories.map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant={productCategoryFilter === cat ? 'default' : 'outline'}
                      onClick={() => setProductCategoryFilter(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant={onlyAvailableProducts ? 'default' : 'outline'}
                    onClick={() => setOnlyAvailableProducts((v) => !v)}
                  >
                    {onlyAvailableProducts ? 'Somente disponíveis' : 'Mostrar indisponíveis'}
                  </Button>

                  <div className="w-full sm:w-[220px]">
                    <Select value={productSort} onValueChange={(v) => setProductSort(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Ordenar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name_asc">Nome (A–Z)</SelectItem>
                        <SelectItem value="price_asc">Preço (menor)</SelectItem>
                        <SelectItem value="price_desc">Preço (maior)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

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
                            Refrigerante {size === 'un' ? 'Unidade' : size.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      if (!selectedSodaSize) {
                        return (
                          <div className="col-span-full text-center py-8">
                            <p className="text-muted-foreground">Selecione um tamanho para ver os refrigerantes disponíveis.</p>
                          </div>
                        );
                      }

                      const itemsForSize = refrigerantes.bySize[selectedSodaSize] || [];
                      const visibleItems = onlyAvailableProducts
                        ? itemsForSize.filter((p) => p.available)
                        : itemsForSize;

                      if (visibleItems.length === 0) {
                        return (
                          <div className="col-span-full text-center py-8">
                            <p className="text-muted-foreground">
                              Nenhum refrigerante {onlyAvailableProducts ? 'disponível ' : ''}para este tamanho.
                            </p>
                          </div>
                        );
                      }

                      return visibleItems.map((product, index) => (
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
                                <Button onClick={() => addProduct(product)} disabled={!product.available}>
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
                if (productCategoryFilter !== '__all__' && productCategoryFilter !== category) return null;

                const categoryProducts = filteredProducts.filter((p) => p.category === category);
                if (categoryProducts.length === 0) return null;

                return (
                  <div key={category} className="mb-8">
                    <h3 className="font-display text-xl font-semibold text-foreground mb-4">{category}</h3>
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
              {filteredProducts.filter((p) => p.category.toLowerCase() !== 'refrigerantes').length === 0 && (
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
