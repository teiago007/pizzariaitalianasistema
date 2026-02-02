// Types for the Pizzeria System

export type PizzaSize = 'P' | 'M' | 'G' | 'GG';

export interface PizzaSizeOption {
  id: string;
  name: string;
  size: PizzaSize;
  price: number;
}

export interface PizzaFlavor {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  image?: string;
  categoryId?: string | null;
  prices: {
    P: number;
    M: number;
    G: number;
    GG: number;
  };
}

export interface PizzaBorder {
  id: string;
  name: string;
  price: number;
  prices?: {
    P: number;
    M: number;
    G: number;
    GG: number;
  };
}

export interface Pizza {
  id: string;
  name: string;
  category: string;
  flavors: PizzaFlavor[];
  sizes: PizzaSizeOption[];
  borders: PizzaBorder[];
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  /** Relacionamento opcional para refrigerantes (novo). Mantém compatibilidade com nomes antigos. */
  drinkSizeId?: string | null;
  /** Nome do tamanho (ex: Lata, 600ml, 2L) para exibição em carrinho/pedido. */
  drinkSizeName?: string | null;
}

export type PaymentMethod = 'pix' | 'cash' | 'card';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export type PrintStatus = 'PENDING' | 'PRINTED';
export type PrintSource = 'customer' | 'staff';

export interface CartItemPizza {
  type: 'pizza';
  id: string;
  size: PizzaSize;
  flavors: PizzaFlavor[];
  border?: PizzaBorder;
  quantity: number;
  unitPrice: number;
  /** Observação individual do item (ex: "sem cebola") */
  note?: string;
}

export interface CartItemProduct {
  type: 'product';
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
}

export type CartItem = CartItemPizza | CartItemProduct;

export interface CustomerInfo {
  name: string;
  phone: string;
  /** Rua/Avenida (para filtros no módulo Entregador) */
  street?: string;
  /** Número (para exibição e mapa) */
  number?: string;
  /** Bairro (para filtros no módulo Entregador) */
  neighborhood?: string;
  /** Ponto de referência (opcional) */
  reference?: string;
  address: string;
  complement?: string;
}

export interface PaymentInfo {
  method: PaymentMethod;
  needsChange?: boolean;
  changeFor?: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  customer: CustomerInfo;
  payment: PaymentInfo;
  status: OrderStatus;
  total: number;
  /** Número sequencial do pedido no dia (gerado no backend) */
  seqOfDay?: number;
  /** 'in_store' para pedidos presenciais (garçom), ou null para pedidos comuns */
  orderOrigin?: string;
  /** Mesa/comanda quando pedido for presencial */
  tableNumber?: string;
  /** Usuário autenticado que criou o pedido (ex: staff) */
  createdByUserId?: string;
  /** Fluxo de impressão (Admin) */
  printStatus?: PrintStatus;
  /** Origem do pedido para regras de auto-impressão */
  printSource?: PrintSource;
  printRequestedAt?: Date;
  printRequestedBy?: string;
  printedAt?: Date;
  printedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PizzeriaSettings {
  name: string;
  logo?: string;
  isOpen: boolean;
  whatsapp: string;
  address: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}
