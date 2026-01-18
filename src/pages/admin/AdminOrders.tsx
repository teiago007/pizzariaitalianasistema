import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, Eye, Clock, CheckCircle, XCircle, Truck, MessageCircle, Loader2, Send, Trash2, Search } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useSettings } from '@/hooks/useSettings';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { Order, OrderStatus, CartItemPizza } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const AdminOrders: React.FC = () => {
  const { orders, loading, updateOrderStatus, deleteOrder } = useOrders();
  const { settings } = useSettings();
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  // Filtros + abas + paginação
  const [tab, setTab] = useState<'today' | 'week' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'__all__' | OrderStatus>('__all__');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Real-time notifications for new orders
  useOrderNotifications((newOrder) => {
    setNewOrderIds(prev => new Set([...prev, newOrder.id]));
    // Remove highlight after 30 seconds
    setTimeout(() => {
      setNewOrderIds(prev => {
        const next = new Set(prev);
        next.delete(newOrder.id);
        return next;
      });
    }, 30000);
  });

  // Exibir todos os pedidos (exceto pendentes)
  const baseOrders = useMemo(() => orders.filter(o => o.status !== 'PENDING'), [orders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();

    let start: Date | null = null;
    let end: Date | null = null;

    if (tab === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (tab === 'week') {
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
    } else {
      // aba "Todos": usa período manual se o usuário preencher
      if (dateFrom) start = startOfDay(new Date(dateFrom + 'T00:00:00'));
      if (dateTo) end = endOfDay(new Date(dateTo + 'T00:00:00'));
    }

    const phone = phoneSearch.trim();

    return baseOrders.filter((o) => {
      if (statusFilter !== '__all__' && o.status !== statusFilter) return false;

      if (phone) {
        const normalized = (s: string) => s.replace(/\D/g, '');
        if (!normalized(o.customer.phone).includes(normalized(phone))) return false;
      }

      if (start && o.createdAt < start) return false;
      if (end && o.createdAt > end) return false;

      return true;
    });
  }, [baseOrders, tab, statusFilter, phoneSearch, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const pagedOrders = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    return filteredOrders.slice(startIdx, startIdx + pageSize);
  }, [filteredOrders, page, totalPages]);

  // reset de página ao mudar filtros
  React.useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, phoneSearch, dateFrom, dateTo]);

  const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
    PENDING: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
    CONFIRMED: { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle },
    PREPARING: { label: 'Preparando', color: 'bg-orange-500', icon: Clock },
    READY: { label: 'Pronto', color: 'bg-green-500', icon: CheckCircle },
    DELIVERED: { label: 'Entregue', color: 'bg-gray-500', icon: Truck },
    CANCELLED: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
  };

  const paymentLabels = {
    pix: 'PIX',
    cash: 'Dinheiro',
    card: 'Cartão',
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    await updateOrderStatus(orderId, status);
  };

  const handleWhatsApp = async (order: Order) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { orderId: order.id, messageType: `order_${order.status.toLowerCase()}` },
      });

      if (error) throw error;

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Erro ao abrir WhatsApp');
    }
  };

  // Button to mark as "out for delivery" and notify customer
  const handleOutForDelivery = async (order: Order) => {
    try {
      // Update status to READY (saindo para entrega)
      await updateOrderStatus(order.id, 'READY');

      // Generate WhatsApp message for "out for delivery"
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { orderId: order.id, messageType: 'order_out_for_delivery' },
      });

      if (error) throw error;

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
      }

      toast.success('Pedido marcado como saindo para entrega!');
    } catch (error) {
      console.error('Error marking out for delivery:', error);
      toast.error('Erro ao processar');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    await deleteOrder(orderId);
  };

  const handlePrint = (order: Order) => {
    const printContent = `
      <html>
        <head>
          <title>Pedido ${order.id.substring(0, 8).toUpperCase()}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; }
            h1 { font-size: 18px; text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .info { margin: 10px 0; }
            .item { margin: 5px 0; }
            .total { font-weight: bold; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>🍕 ${settings.name}</h1>
          <div class="info"><strong>Pedido:</strong> ${order.id.substring(0, 8).toUpperCase()}</div>
          <div class="info"><strong>Data:</strong> ${new Date(order.createdAt).toLocaleString('pt-BR')}</div>
          <div class="info"><strong>Cliente:</strong> ${order.customer.name}</div>
          <div class="info"><strong>Telefone:</strong> ${order.customer.phone}</div>
          <div class="info"><strong>Endereço:</strong> ${order.customer.address}</div>
          ${order.customer.complement ? `<div class="info"><strong>Complemento:</strong> ${order.customer.complement}</div>` : ''}
          <hr/>
          <div><strong>Itens:</strong></div>
          ${order.items.map(item => {
            if (item.type === 'pizza') {
              return `<div class="item">${item.quantity}x Pizza ${item.flavors.map(f => f.name).join(' + ')} (${item.size}) - R$ ${(item.unitPrice * item.quantity).toFixed(2)}</div>`;
            } else {
              return `<div class="item">${item.quantity}x ${item.product.name} - R$ ${(item.unitPrice * item.quantity).toFixed(2)}</div>`;
            }
          }).join('')}
          <div class="total">TOTAL: R$ ${order.total.toFixed(2)}</div>
          <div class="info"><strong>Pagamento:</strong> ${paymentLabels[order.payment.method]}</div>
          ${order.payment.needsChange ? `<div class="info"><strong>Troco para:</strong> R$ ${order.payment.changeFor?.toFixed(2)}</div>` : ''}
          <div class="footer">Obrigado pela preferência!</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const OrderDetails: React.FC<{ order: Order }> = ({ order }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Cliente</p>
          <p className="font-medium">{order.customer.name}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Telefone</p>
          <p className="font-medium">{order.customer.phone}</p>
        </div>
        <div className="col-span-2">
          <p className="text-sm text-muted-foreground">Endereço</p>
          <p className="font-medium">{order.customer.address}</p>
          {order.customer.complement && (
            <p className="text-sm text-muted-foreground">{order.customer.complement}</p>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-2">Itens do Pedido</p>
        <div className="space-y-3">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between items-start p-3 bg-muted/30 rounded-lg">
              <div className="flex-1">
                {item.type === 'pizza' ? (
                  <>
                    <p className="font-medium">
                      Pizza {(item as CartItemPizza).size} - {(item as CartItemPizza).flavors.length} sabor(es)
                    </p>
                    <div className="text-sm text-muted-foreground mt-1">
                      {(item as CartItemPizza).flavors.map((f, i) => (
                        <span key={f.id}>
                          {i > 0 && ' + '}
                          <span className="font-medium text-foreground">{f.name}</span>
                        </span>
                      ))}
                    </div>
                    {(item as CartItemPizza).border && (
                      <p className="text-sm text-muted-foreground">
                        Borda: {(item as CartItemPizza).border?.name}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium">{item.product.name}</p>
                )}
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
          <Badge variant="outline">{paymentLabels[order.payment.method]}</Badge>
        </div>
        {order.payment.needsChange && (
          <p className="text-sm text-muted-foreground mt-1">
            Troco para: R$ {order.payment.changeFor?.toFixed(2)}
          </p>
        )}
      </div>

      <div className="border-t pt-4 flex justify-between items-center">
        <p className="font-bold text-lg">Total</p>
        <p className="font-bold text-lg text-primary">R$ {order.total.toFixed(2)}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pedidos</h1>
        <p className="text-muted-foreground">Gerencie os pedidos confirmados</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <div className="flex flex-col gap-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="Buscar por telefone"
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                <SelectItem value="READY">Pronto</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={tab !== 'all'}
                title="Data inicial (somente na aba Todos)"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={tab !== 'all'}
                title="Data final (somente na aba Todos)"
              />
            </div>
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {pagedOrders.length > 0 ? (
            <>
              <div className="space-y-4">
                {pagedOrders.map((order, index) => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;
                  const isNew = newOrderIds.has(order.id);

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={isNew ? 'ring-2 ring-secondary ring-offset-2 bg-secondary/5 animate-pulse' : ''}>
                        <CardContent className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Order Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {isNew && (
                                  <Badge className="bg-secondary text-secondary-foreground animate-bounce">
                                    NOVO!
                                  </Badge>
                                )}
                                <span className="font-bold text-lg">{order.id.substring(0, 8).toUpperCase()}</span>
                                <Badge className={`${status.color} text-white`}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {status.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {order.customer.name} • {order.customer.phone}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(order.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>

                            {/* Price */}
                            <div className="text-right lg:text-center">
                              <p className="text-2xl font-bold text-primary">R$ {order.total.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={order.status}
                                onValueChange={(value) => handleStatusChange(order.id, value as OrderStatus)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                                  <SelectItem value="READY">Pronto</SelectItem>
                                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Out for delivery button */}
                              {(order.status === 'CONFIRMED' || order.status === 'PREPARING' || order.status === 'READY') && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleOutForDelivery(order)}
                                  className="gap-1"
                                  title="Avisar saída para entrega"
                                >
                                  <Send className="w-4 h-4" />
                                  <span className="hidden sm:inline">Saindo</span>
                                </Button>
                              )}

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
                                  <OrderDetails order={order} />
                                </DialogContent>
                              </Dialog>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleWhatsApp(order)}
                                title="Enviar WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>

                              <Button variant="outline" size="icon" onClick={() => handlePrint(order)} title="Imprimir pedido">
                                <Printer className="w-4 h-4" />
                              </Button>

                              {/* Delete Order Button */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    title="Remover pedido"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover Pedido?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover o pedido {order.id.substring(0, 8).toUpperCase()}? Esta ação não pode
                                      ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <p className="text-sm text-muted-foreground">Mostrando {pagedOrders.length} de {filteredOrders.length} pedidos</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {Math.min(page, totalPages)} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros para ver outros resultados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOrders;