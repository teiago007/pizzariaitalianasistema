import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MapPin, Phone, User, Clock } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useStore } from '@/contexts/StoreContext';
import { useStoreAvailability } from '@/hooks/useStoreAvailability';
import { CartItemPizza, CustomerInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const parseDrinkSize = (name: string) => {
  const m = name.trim().match(/(\d+[\.,]?\d*)\s*(ml|l)\s*$/i);
  if (!m) return null;
  const value = m[1].replace(',', '.');
  const unit = m[2].toLowerCase();
  return `${value}${unit}`;
};

const stripDrinkSize = (name: string) => name.replace(/\s*(\d+[\.,]?\d*)\s*(ml|l)\s*$/i, '').trim();

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

    const base = explicitSize ? String(product.name || '') : legacySize ? stripDrinkSize(String(product.name || '')) : String(product.name || '');
    const genericName = base.toLowerCase().includes('refrigerante');
    // Bloqueia quando faltar tamanho OU quando o nome ainda é genérico (ex: "REFRIGERANTE 2L").
    return !sizeOk || genericName;
  });
};

const formatNextOpenShort = (nextOpenAt?: { date: string; time: string }) => {
  if (!nextOpenAt) return undefined;
  const d = new Date(`${nextOpenAt.date}T00:00:00-03:00`);
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d);
  return `${dayLabel} ${nextOpenAt.time}`;
};

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isStaffFlow = location.pathname.startsWith('/funcionario');
  const paths = {
    cart: isStaffFlow ? '/funcionario/carrinho' : '/carrinho',
    payment: isStaffFlow ? '/funcionario/pagamento' : '/pagamento',
  };
  const { settings } = useStore();
  const { availability } = useStoreAvailability(settings.isOpen);
  const { items, total, itemCount, updatePizzaNote } = useCart();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    street: '',
    neighborhood: '',
    address: '',
    complement: '',
  });

  const composedAddress = `${(customerInfo.street || '').trim()}${customerInfo.neighborhood ? ` - ${customerInfo.neighborhood.trim()}` : ''}`.trim();

  const pizzasInCart = items
    .map((it, idx) => ({ it, idx }))
    .filter((x) => x.it.type === 'pizza') as Array<{ it: CartItemPizza; idx: number }>;

  // Redirect if cart is empty
  if (items.length === 0) {
    navigate(paths.cart);
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCustomerInfo(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setCustomerInfo(prev => ({ ...prev, phone: formatted }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!availability.isOpenNow) {
      const nextOpen = formatNextOpenShort(availability.nextOpenAt);
      toast.error(nextOpen ? `Loja fechada. Próxima abertura: ${nextOpen}.` : 'Loja fechada no momento.');
      return;
    }

    if (!customerInfo.name.trim()) {
      toast.error('Por favor, informe seu nome');
      return;
    }
    if (customerInfo.phone.replace(/\D/g, '').length < 10) {
      toast.error('Por favor, informe um telefone válido');
      return;
    }
    if (!String(customerInfo.street || '').trim()) {
      toast.error('Por favor, informe a rua/avenida');
      return;
    }
    if (!String(customerInfo.neighborhood || '').trim()) {
      toast.error('Por favor, informe o bairro');
      return;
    }

    if (hasInvalidSodaInCart(items as any[])) {
      toast.error('Escolha o refrigerante específico antes de finalizar (volte ao carrinho e ajuste).');
      return;
    }

    // Store customer info and navigate to payment
    // Keep address as a composed string for compatibility and display.
    const payload: CustomerInfo = {
      ...customerInfo,
      address: composedAddress,
    };
    sessionStorage.setItem('customerInfo', JSON.stringify(payload));
    navigate(paths.payment);
  };

  const nextOpenShort = formatNextOpenShort(availability.nextOpenAt);

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(paths.cart)}
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Carrinho
          </button>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Dados para Entrega
          </h1>
          <p className="text-muted-foreground mt-2">
            Informe seus dados para finalizarmos o pedido
          </p>
        </motion.div>

        {!availability.isOpenNow && (
          <div className="mb-6 p-4 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground flex items-start gap-3">
            <Clock className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Loja fechada no momento</p>
              <p>
                {nextOpenShort
                  ? `Voltamos a aceitar pedidos em: ${nextOpenShort}.`
                  : 'Voltaremos a aceitar pedidos em breve.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" />
                Seus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  name="name"
                  value={customerInfo.name}
                  onChange={handleChange}
                  placeholder="Seu nome completo"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    name="phone"
                    value={customerInfo.phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    className="pl-10"
                    maxLength={15}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                Endereço de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="street">Rua / Avenida *</Label>
                <Input
                  id="street"
                  name="street"
                  value={customerInfo.street || ''}
                  onChange={handleChange}
                  placeholder="Ex: Rua das Flores, 123"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="neighborhood">Bairro *</Label>
                <Input
                  id="neighborhood"
                  name="neighborhood"
                  value={customerInfo.neighborhood || ''}
                  onChange={handleChange}
                  placeholder="Ex: Centro"
                  className="mt-1.5"
                />
              </div>

              {/* Compatibilidade: mantém um campo composto para visualização/validação */}
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="text-muted-foreground">Endereço (resumo)</p>
                <p className="font-medium text-foreground">{composedAddress || '—'}</p>
              </div>

              <div>
                <Label htmlFor="complement">Complemento (opcional)</Label>
                <Input
                  id="complement"
                  name="complement"
                  value={customerInfo.complement}
                  onChange={handleChange}
                  placeholder="Apartamento, bloco, referência..."
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Item notes (pizzas) */}
          {pizzasInCart.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Observações por pizza</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Se precisar, deixe uma observação individual para cada pizza (ex: "meia sem cebola").
                </p>

                <div className="space-y-4">
                  {pizzasInCart.map(({ it, idx }, i) => (
                    <div key={it.id} className="rounded-lg border bg-card p-4">
                      <p className="font-medium text-foreground">
                        Pizza {i + 1}: {(it.flavors || []).map((f) => f.name).join(' + ') || 'Pizza'} ({it.size})
                      </p>
                      <Label htmlFor={`pizza-note-${it.id}`} className="text-sm text-muted-foreground">
                        Observação (opcional)
                      </Label>
                      <Input
                        id={`pizza-note-${it.id}`}
                        value={it.note || ''}
                        onChange={(e) => updatePizzaNote(idx, e.target.value)}
                        placeholder='Ex: sem cebola / bem passada'
                        className="mt-1.5"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Summary */}
          <Card className="mb-6 bg-muted/30">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {itemCount} {itemCount === 1 ? 'item' : 'itens'} no carrinho
                </span>
                <span className="text-xl font-bold text-primary">
                  R$ {total.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={!availability.isOpenNow}>
            Continuar para Pagamento
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
