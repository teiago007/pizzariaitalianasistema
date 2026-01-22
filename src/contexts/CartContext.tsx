import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CartItem, CartItemPizza, CartItemProduct, PizzaSize, PizzaFlavor, PizzaBorder, Product } from '@/types';

interface CartContextType {
  items: CartItem[];
  addPizza: (size: PizzaSize, flavors: PizzaFlavor[], border?: PizzaBorder) => void;
  addProduct: (product: Product, quantity?: number) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  updatePizzaNote: (index: number, note: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    // Fail-safe: avoid blank screen if a component renders outside provider for any reason.
    // The app should normally wrap everything with <CartProvider> in App.tsx.
    console.warn('useCart used outside CartProvider; returning empty cart (fail-safe)');
    return {
      items: [],
      addPizza: () => undefined,
      addProduct: () => undefined,
      removeItem: () => undefined,
      updateQuantity: () => undefined,
      updatePizzaNote: () => undefined,
      clearCart: () => undefined,
      total: 0,
      itemCount: 0,
    };
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

const calculatePizzaPrice = (size: PizzaSize, flavors: PizzaFlavor[], border?: PizzaBorder): number => {
  // Get highest price among flavors for this size
  const safeFlavorPrices = (flavors || [])
    .map((f) => Number((f as any)?.prices?.[size]))
    .filter((n) => Number.isFinite(n));
  const flavorPrice = safeFlavorPrices.length > 0 ? Math.max(...safeFlavorPrices) : 0;
  // Use size-specific border price if available
  const borderPrice = border 
    ? (border.prices?.[size] || border.price || 0) 
    : 0;
  return flavorPrice + borderPrice;
};

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addPizza = useCallback((size: PizzaSize, flavors: PizzaFlavor[], border?: PizzaBorder) => {
    const unitPrice = calculatePizzaPrice(size, flavors, border);
    const newItem: CartItemPizza = {
      type: 'pizza',
      id: `pizza-${Date.now()}`,
      size,
      flavors,
      border,
      quantity: 1,
      unitPrice,
    };
    setItems(prev => [...prev, newItem]);
  }, []);

  const addProduct = useCallback((product: Product, quantity = 1) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.type === 'product' && (item as CartItemProduct).product.id === product.id
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      const newItem: CartItemProduct = {
        type: 'product',
        id: `product-${Date.now()}`,
        product,
        quantity,
        unitPrice: product.price,
      };
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity };
      return updated;
    });
  }, [removeItem]);

  const updatePizzaNote = useCallback((index: number, note: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (!current || current.type !== 'pizza') return prev;
      updated[index] = {
        ...(current as CartItemPizza),
        note: note.trim() ? note : undefined,
      };
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addPizza,
        addProduct,
        removeItem,
        updateQuantity,
        updatePizzaNote,
        clearCart,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
