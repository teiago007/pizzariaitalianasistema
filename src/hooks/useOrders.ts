import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus, CartItem, CustomerInfo, PaymentMethod } from '@/types';
import { toast } from 'sonner';

export type UseOrdersOptions = {
  /** Filtra por 1 ou mais status (ex: ['READY','DELIVERED']) */
  status?: OrderStatus | OrderStatus[];
  /** Filtra pedidos a partir de created_at (inclusive) */
  createdFrom?: Date | string;
  /** Filtra pedidos até created_at (inclusive) */
  createdTo?: Date | string;
  /** Filtra por origem (ex: 'in_store') */
  orderOrigin?: string;
  /** Filtra por usuário criador (ex: staff) */
  createdByUserId?: string;
  /** Limita quantidade retornada (útil em telas não-admin) */
  limit?: number;
};

interface DbOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_street?: string | null;
  customer_number?: string | null;
  customer_neighborhood?: string | null;
  customer_reference?: string | null;
  customer_address: string;
  customer_complement: string | null;
  order_origin?: string | null;
  table_number?: string | null;
  created_by_user_id?: string | null;
  seq_of_day?: number | null;
  items: any;
  payment_method: string;
  needs_change: boolean | null;
  change_for: number | null;
  total: number;
  status: string;
  pix_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

const mapDbToOrder = (dbOrder: DbOrder): Order => ({
  id: dbOrder.id,
  customer: {
    name: dbOrder.customer_name,
    phone: dbOrder.customer_phone,
    street: dbOrder.customer_street ?? undefined,
    number: dbOrder.customer_number ?? undefined,
    neighborhood: dbOrder.customer_neighborhood ?? undefined,
    reference: dbOrder.customer_reference ?? undefined,
    address: dbOrder.customer_address,
    complement: dbOrder.customer_complement || undefined,
  },
  items: dbOrder.items as CartItem[],
  payment: {
    method: dbOrder.payment_method as PaymentMethod,
    needsChange: dbOrder.needs_change || undefined,
    changeFor: dbOrder.change_for || undefined,
  },
  total: Number(dbOrder.total),
  status: dbOrder.status as OrderStatus,
  seqOfDay: typeof dbOrder.seq_of_day === 'number' ? dbOrder.seq_of_day : undefined,
  orderOrigin: dbOrder.order_origin || undefined,
  tableNumber: dbOrder.table_number || undefined,
  createdByUserId: dbOrder.created_by_user_id || undefined,
  createdAt: new Date(dbOrder.created_at),
  updatedAt: new Date(dbOrder.updated_at),
});

const ORDERS_SELECT = [
  'id',
  'customer_name',
  'customer_phone',
  'customer_street',
  'customer_number',
  'customer_neighborhood',
  'customer_reference',
  'customer_address',
  'customer_complement',
  'order_origin',
  'table_number',
  'created_by_user_id',
  'seq_of_day',
  'items',
  'payment_method',
  'needs_change',
  'change_for',
  'total',
  'status',
  'pix_transaction_id',
  'created_at',
  'updated_at',
].join(',');

const toIso = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString());

const isOrderMatchingOptions = (order: Order, options: UseOrdersOptions) => {
  if (options.orderOrigin && order.orderOrigin !== options.orderOrigin) return false;
  if (options.createdByUserId && order.createdByUserId !== options.createdByUserId) return false;

  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    if (!statuses.includes(order.status)) return false;
  }

  if (options.createdFrom) {
    const from = new Date(toIso(options.createdFrom));
    if (order.createdAt < from) return false;
  }
  if (options.createdTo) {
    const to = new Date(toIso(options.createdTo));
    if (order.createdAt > to) return false;
  }

  return true;
};

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      let query = supabase
        .from('orders')
        .select(ORDERS_SELECT)
        .order('created_at', { ascending: false });

      if (options.orderOrigin) query = query.eq('order_origin', options.orderOrigin);
      if (options.createdByUserId) query = query.eq('created_by_user_id', options.createdByUserId);

      if (options.status) {
        const statuses = Array.isArray(options.status) ? options.status : [options.status];
        query = query.in('status', statuses);
      }

      if (options.createdFrom) query = query.gte('created_at', toIso(options.createdFrom));
      if (options.createdTo) query = query.lte('created_at', toIso(options.createdTo));

      if (typeof options.limit === 'number') query = query.limit(options.limit);

      const { data, error } = await query;

      if (error) throw error;

      setOrders(((data ?? []) as unknown as DbOrder[]).map(mapDbToOrder));
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [
    options.createdByUserId,
    options.createdFrom,
    options.createdTo,
    options.limit,
    options.orderOrigin,
    // status pode ser array (instável); normaliza em string para dependência
    Array.isArray(options.status) ? options.status.join('|') : options.status,
  ]);

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as DbOrder).id;
            setOrders((prev) => prev.filter((o) => o.id !== id));
            return;
          }

          const mapped = mapDbToOrder(payload.new as DbOrder);
          const shouldExist = isOrderMatchingOptions(mapped, options);

          if (payload.eventType === 'INSERT') {
            if (!shouldExist) return;
            setOrders((prev) => {
              if (prev.some((o) => o.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
            return;
          }

          if (payload.eventType === 'UPDATE') {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === mapped.id);

              if (shouldExist) {
                if (exists) return prev.map((o) => (o.id === mapped.id ? mapped : o));
                return [mapped, ...prev];
              }

              // Se não bate nos filtros atuais, remove da lista
              return exists ? prev.filter((o) => o.id !== mapped.id) : prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const createOrder = async (
    items: CartItem[],
    customer: CustomerInfo,
    paymentMethod: PaymentMethod,
    total: number,
    needsChange?: boolean,
    changeFor?: number
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_street: customer.street?.trim() || null,
          customer_number: customer.number?.trim() || null,
          customer_neighborhood: customer.neighborhood?.trim() || null,
          customer_reference: customer.reference?.trim() || null,
          customer_address: customer.address,
          customer_complement: customer.complement || null,
          items: items as unknown as import('@/integrations/supabase/types').Json,
          payment_method: paymentMethod as 'pix' | 'cash' | 'card',
          needs_change: needsChange || false,
          change_for: changeFor || null,
          total: total,
          status: 'PENDING' as const,
        })
        .select()
        .single();

      if (error) throw error;

      return data.id;
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Erro ao criar pedido');
      return null;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      // Send WhatsApp notification
      const messageTypeMap: Record<OrderStatus, string> = {
        PENDING: 'order_pending',
        CONFIRMED: 'order_confirmed',
        PREPARING: 'order_preparing',
        READY: 'order_ready',
        DELIVERED: 'order_delivered',
        CANCELLED: 'order_cancelled',
      };

      await supabase.functions.invoke('send-whatsapp', {
        body: { orderId, messageType: messageTypeMap[status] },
      });

      toast.success('Status atualizado');
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const confirmOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CONFIRMED' })
        .eq('id', orderId);

      if (error) throw error;

      // Send confirmation WhatsApp
      await supabase.functions.invoke('send-whatsapp', {
        body: { orderId, messageType: 'order_confirmed' },
      });

      return true;
    } catch (error) {
      console.error('Error confirming order:', error);
      return false;
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Pedido removido');
      return true;
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Erro ao remover pedido');
      return false;
    }
  };

  return {
    orders,
    loading,
    createOrder,
    updateOrderStatus,
    confirmOrder,
    deleteOrder,
    refetch: fetchOrders,
  };
}