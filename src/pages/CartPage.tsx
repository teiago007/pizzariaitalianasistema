import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft, Clock, Copy } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useStore } from '@/contexts/StoreContext';
import { useStoreAvailability } from '@/hooks/useStoreAvailability';
import { CartItemPizza, CartItemProduct } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const formatNextOpenShort = (nextOpenAt?: { date: string; time: string }) => {
  if (!nextOpenAt) return undefined;
  const d = new Date(`${nextOpenAt.date}T00:00:00-03:00`);
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d);
  return `${dayLabel} ${nextOpenAt.time}`;
};

const parseDrinkSize = (name: string) => {
  const m = name.trim().match(/(\d+[\.,]?\d*)\s*(ml|l)\s*$/i);
  if (!m) return null;
  const value = m[1].replace(',', '.');
  const unit = m[2].toLowerCase();
  return `${value}${unit}`;
};

const stripDrinkSize = (name: string) => name.replace(/\s*(\d+[\.,]?\d*)\s*(ml|l)\s*$/i, '').trim();

const safeMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isStaffFlow = location.pathname.startsWith('/funcionario');
  const paths = {
    menu: isStaffFlow ? '/funcionario/pedidos' : '/cardapio',
    cart: isStaffFlow ? '/funcionario/carrinho' : '/carrinho',
    checkout: isStaffFlow ? '/funcionario/checkout' : '/checkout',
  };
  const { settings } = useStore();
  const { availability } = useStoreAvailability(settings.isOpen);
  const { items, removeItem, updateQuantity, total, clearCart, addPizza } = useCart();

  const sizeLabels = {
    P: 'Pequena',
    M: 'Média',
    G: 'Grande',
    GG: 'Gigante',
  };

  const renderPizzaItem = (item: CartItemPizza, index: number) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-4"
    >
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {item.flavors[0]?.image ? (
            <img
              src={item.flavors[0].image}
              alt={item.flavors[0].name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🍕</div>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            Pizza {(item.flavors || []).length > 0 ? (item.flavors || []).map((f) => f.name).join(' + ') : '(sabores não informados)'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {sizeLabels[item.size]}
            {item.border && ` • Borda ${item.border.name}`}
          </p>
          <p className="text-primary font-bold mt-1">
            R$ {safeMoney(item.unitPrice).toFixed(2)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => addPizza(item.size, item.flavors, item.border)}
              className="h-8 w-8"
              aria-label="Repetir item"
              title="Repetir item"
            >
              <Copy className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              className="text-destructive hover:text-destructive"
              aria-label="Remover item"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateQuantity(index, item.quantity - 1)}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="w-8 text-center font-medium">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateQuantity(index, item.quantity + 1)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderProductItem = (item: CartItemProduct, index: number) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-4"
    >
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
          {item.product.image ? (
            <img
              src={item.product.image}
              alt={item.product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">🥤</span>
          )}
        </div>

        <div className="flex-1">
          {(() => {
            const isSoda = item.product.category?.toLowerCase() === 'refrigerantes';
            const size = parseDrinkSize(item.product.name);
            const baseName = size ? stripDrinkSize(item.product.name) : item.product.name;

            return (
              <>
                <h3 className="font-semibold text-foreground">
                  {isSoda ? baseName : `${baseName}${size ? ` (${size.toUpperCase()})` : ''}`}
                </h3>
                {isSoda && size && <p className="text-sm text-muted-foreground">{size.toUpperCase()}</p>}
                {item.product.description ? (
                  <p className="text-sm text-muted-foreground">{item.product.description}</p>
                ) : null}
              </>
            );
          })()}
          <p className="text-primary font-bold mt-1">
            R$ {safeMoney(item.unitPrice).toFixed(2)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeItem(index)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateQuantity(index, item.quantity - 1)}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="w-8 text-center font-medium">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateQuantity(index, item.quantity + 1)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            Carrinho Vazio
          </h2>
          <p className="text-muted-foreground mb-6">
            Adicione itens deliciosos ao seu carrinho!
          </p>
          <Link to={paths.menu}>
            <Button size="lg">
              Ver Cardápio
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const nextOpenShort = formatNextOpenShort(availability.nextOpenAt);
  const canCheckout = availability.isOpenNow;

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link to={paths.menu} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continuar Comprando
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Meu Carrinho
          </h1>
        </motion.div>

        <div className="grid gap-6">
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <AnimatePresence>
                {items.map((item, index) =>
                  item.type === 'pizza'
                    ? renderPizzaItem(item as CartItemPizza, index)
                    : renderProductItem(item as CartItemProduct, index)
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>R$ {safeMoney(total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Entrega</span>
                  <span className="text-secondary">Grátis</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {safeMoney(total).toFixed(2)}</span>
                </div>
              </div>

              {!canCheckout && (
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Não estamos aceitando pedidos agora.
                  {nextOpenShort ? ` Próxima abertura: ${nextOpenShort}.` : ''}
                </div>
              )}

              <div className="mt-6 space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    if (!canCheckout) {
                      toast.error(
                        nextOpenShort
                          ? `Loja fechada. Próxima abertura: ${nextOpenShort}.`
                          : 'Loja fechada no momento.'
                      );
                      return;
                    }
                    navigate(paths.checkout);
                  }}
                  disabled={!canCheckout}
                >
                  Finalizar Pedido
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={clearCart}
                >
                  Limpar Carrinho
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
