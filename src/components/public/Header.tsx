import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, MapPin, Phone, Clock } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useStore } from '@/contexts/StoreContext';
import { useStoreAvailability } from '@/hooks/useStoreAvailability';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const formatNextOpen = (nextOpenAt?: { date: string; time: string }) => {
  if (!nextOpenAt) return undefined;
  const d = new Date(`${nextOpenAt.date}T00:00:00-03:00`);
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d);
  return `${dayLabel} às ${nextOpenAt.time}`;
};

export const Header: React.FC = () => {
  const { itemCount } = useCart();
  const { settings } = useStore();
  const { availability } = useStoreAvailability(settings.isOpen);

  const nextOpenLabel = formatNextOpen(availability.nextOpenAt);

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      {/* Status banner */}
      <div className="border-b border-border bg-muted/40">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {availability.isOpenNow ? (
                <span>
                  <span className="font-medium text-foreground">Aberto agora</span>
                  {availability.closesAt ? ` • fecha às ${availability.closesAt}` : null}
                </span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">Fechado</span>
                  {nextOpenLabel ? ` • abre ${nextOpenLabel}` : null}
                </span>
              )}
            </div>

            {availability.isOpenNow ? (
              <Badge variant="default" className="bg-secondary text-secondary-foreground">Aberto</Badge>
            ) : (
              <Badge variant="destructive">Fechado</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Top bar with info */}
        <div className="hidden md:flex items-center justify-between py-2 text-sm border-b border-border/50">
          <div className="flex items-center gap-6 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              {settings.address}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-secondary" />
              {settings.whatsapp}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {availability.isOpenNow ? (
              <Badge variant="default" className="bg-secondary text-secondary-foreground">
                Aberto
              </Badge>
            ) : (
              <Badge variant="destructive">Fechado</Badge>
            )}
          </div>
        </div>

        {/* Main header */}
        <div className="flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 10 }}
              className="w-12 h-12 rounded-full bg-primary flex items-center justify-center overflow-hidden"
            >
              {settings.logo ? (
                <img
                  src={settings.logo}
                  alt={`Logo ${settings.name}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<span class="text-xl">🍕</span>';
                  }}
                />
              ) : (
                <span className="text-xl">🍕</span>
              )}
            </motion.div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">
                {settings.name}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Sabor autêntico italiano
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 md:gap-4">
            <Link to="/cardapio">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Cardápio
              </Button>
            </Link>
            <Link to="/carrinho">
              <Button variant="outline" size="sm" className="relative">
                <ShoppingCart className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Carrinho</span>
                {itemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </Button>
            </Link>
          </nav>
        </div>

        {/* Mobile info bar */}
        <div className="md:hidden flex items-center justify-between py-2 text-xs border-t border-border/50">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {settings.address.split('|')[0]}
          </span>
          {availability.isOpenNow ? (
            <Badge variant="default" className="bg-secondary text-secondary-foreground text-xs">
              Aberto
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Fechado</Badge>
          )}
        </div>
      </div>
    </header>
  );
};
