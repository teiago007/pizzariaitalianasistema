import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Printer,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  MessageCircle,
  Loader2,
  Send,
  Trash2,
  Search,
  Bluetooth,
  ExternalLink,
} from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useSettings } from '@/hooks/useSettings';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { useAdmin } from '@/contexts/AdminContext';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Order, OrderStatus, CartItemPizza } from '@/types';
import { useBluetoothEscposPrinter } from '@/hooks/useBluetoothEscposPrinter';
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

const TZ = 'America/Sao_Paulo';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const dateISOInTZ = (d: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const addDaysISO = (date: string, days: number) => {
  const dd = new Date(`${date}T00:00:00-03:00`);
  dd.setDate(dd.getDate() + days);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, '0');
  const day = String(dd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AdminOrders: React.FC = () => {
  const { orders, loading, updateOrderStatus, deleteOrder } = useOrders();
  const { settings } = useSettings();
  const { user } = useAdmin();
  const { prefs: notifPrefs } = useNotificationPreferences(user?.id);
  const bt = useBluetoothEscposPrinter();
  const showOpenInNewTab = React.useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const openInNewTab = React.useCallback(() => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  }, []);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros + abas + paginação
  const [tab, setTab] = useState<'today' | 'week' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'__all__' | OrderStatus>('__all__');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Notificações no Admin (preferências por usuário)
  useOrderNotifications(
    (newOrder) => {
    setNewOrderIds(prev => new Set([...prev, newOrder.id]));
    // Remove highlight after 30 seconds
    setTimeout(() => {
      setNewOrderIds(prev => {
        const next = new Set(prev);
        next.delete(newOrder.id);
        return next;
      });
    }, 30000);
    },
    {
      playSound: notifPrefs.play_sound,
      notifyPending: notifPrefs.notify_pending,
      notifyConfirmed: notifPrefs.notify_confirmed,
    }
  );

  // Deep-link: /admin/pedidos?focus=<orderId>
  React.useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus) return;

    // Garantir que o pedido apareça (sem filtros/aba restritiva)
    setTab('all');
    setStatusFilter('__all__');
    setPhoneSearch('');
    setDateFrom('');
    setDateTo('');

    // marca highlight e tenta scroll
    setNewOrderIds((prev) => new Set([...prev, focus]));

    const t = window.setTimeout(() => {
      const el = document.getElementById(`order-${focus}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // limpa o param para não repetir ao navegar
      searchParams.delete('focus');
      setSearchParams(searchParams, { replace: true });
    }, 250);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exibir todos os pedidos (incluindo PENDING)
  // Motivo: pedidos feitos no público podem iniciar como PENDING e precisam aparecer no Admin para conferência.
  const baseOrders = useMemo(() => orders, [orders]);

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

  const parseDrinkSize = (name: string) => {
    const m = name.trim().match(/(\d+[\.,]?\d*)\s*(ml|l)\s*$/i);
    if (!m) return null;
    const value = m[1].replace(',', '.');
    const unit = m[2].toLowerCase();
    return `${value}${unit}`;
  };

  const stripDrinkSize = (name: string) => name.replace(/\s*(\d+[\.,]?\d*)\s*(ml|l)\s*$/i, '').trim();

  const formatProductLabel = (product: any) => {
    const name = String(product?.name || 'Produto');
    const explicitSize = product?.drinkSizeName as string | null | undefined;
    if (explicitSize) return `${name} (${String(explicitSize)})`;
    const size = parseDrinkSize(name);
    if (!size) return name;
    return `${stripDrinkSize(name)} (${size.toUpperCase()})`;
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

  const handlePrint = async (order: Order) => {
    // Sequencial robusto do dia: vem pronto do backend no campo seqOfDay.
    // (fallback: se for pedido antigo sem seq, tenta estimar por contagem)
    let seqOfDay: number | undefined = order.seqOfDay;
    if (typeof seqOfDay !== 'number') {
      try {
        const orderDateISO = dateISOInTZ(new Date(order.createdAt));
        const dayStart = `${orderDateISO}T00:00:00-03:00`;
        const orderTimeISO = new Date(order.createdAt).toISOString();

        const { count, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dayStart)
          .lt('created_at', orderTimeISO);

        if (!error && typeof count === 'number') seqOfDay = count + 1;
      } catch {
        // ignore
      }
    }

    const fmt = (n: number) => Number(n || 0).toFixed(2);
    const hasLogo = Boolean((settings as any).logo);
    const logoUrl = (settings as any).logo || '';

    const itemsHtml = order.items
      .map((item) => {
        if (item.type === 'pizza') {
          const pizza = item as any;
          const flavors = (pizza.flavors || []).map((f: any) => f.name).join(' + ') || 'Pizza';
          const border = pizza.border?.name ? ` • Borda ${pizza.border.name}` : '';
          const obs = pizza.note ? `<div class="muted">Obs: ${escapeHtml(String(pizza.note))}</div>` : '';
          return `
            <div class="row">
              <div class="qty">${pizza.quantity}x</div>
              <div class="name">
                <div class="title">Pizza ${escapeHtml(flavors)} (${escapeHtml(String(pizza.size))})</div>
                ${border ? `<div class="muted">${escapeHtml(border.replace(/^\s*•\s*/, ''))}</div>` : ''}
                ${obs}
              </div>
              <div class="price">R$ ${fmt(pizza.unitPrice * pizza.quantity)}</div>
            </div>
          `;
        }
        const p = (item as any).product;
        return `
          <div class="row">
            <div class="qty">${item.quantity}x</div>
            <div class="name"><div class="title">${escapeHtml(formatProductLabel(p))}</div></div>
            <div class="price">R$ ${fmt(item.unitPrice * item.quantity)}</div>
          </div>
        `;
      })
      .join('');

    const printContent = `
      <html>
        <head>
          <title>Pedido ${order.id.substring(0, 8).toUpperCase()}</title>
          <style>
            :root { --paper: 80mm; --m: 3mm; --font: 11px; --font-sm: 10px; --font-lg: 14px; }
            @page { size: var(--paper) auto; margin: var(--m); }
            html, body { width: var(--paper); margin: 0; padding: 0; color: #000;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
              font-size: var(--font);
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .wrap { padding: var(--m); }
            .center { text-align: center; }
            .muted { color: #222; font-size: var(--font-sm); }
            .hr { border-top: 1px dashed #000; margin: 8px 0; }
            .logo { display: ${hasLogo ? 'block' : 'none'}; width: 100%; max-height: 20mm; object-fit: contain; margin: 0 auto 6px auto; }
            .store { font-size: var(--font-lg); font-weight: 700; letter-spacing: 0.5px; }
            .row { display: grid; grid-template-columns: 10mm 1fr auto; gap: 6px; align-items: start; margin: 6px 0; }
            .qty { font-weight: 700; }
            .title { font-weight: 700; }
            .price { font-weight: 700; white-space: nowrap; text-align: right; }
            .totals { margin-top: 10px; padding-top: 8px; border-top: 2px dashed #000; }
            .total-line { display: flex; justify-content: space-between; font-size: var(--font-lg); font-weight: 800; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <img class="logo" src="${escapeHtml(String(logoUrl))}" alt="Logo" />
            <div class="center store">${escapeHtml(String(settings.name || ''))}</div>
            <div class="center muted">${escapeHtml(String(settings.address || ''))}</div>

            <div class="hr"></div>
            <div>
              <div><strong>Pedido:</strong> ${order.id.substring(0, 8).toUpperCase()}</div>
              ${seqOfDay ? `<div><strong>Seq. do dia:</strong> ${seqOfDay}</div>` : ''}
              ${order.tableNumber ? `<div><strong>Mesa/Comanda:</strong> ${escapeHtml(String(order.tableNumber))}</div>` : ''}
              <div><strong>Data:</strong> ${escapeHtml(new Date(order.createdAt).toLocaleString('pt-BR'))}</div>
              <div><strong>Pagamento:</strong> ${escapeHtml(String(paymentLabels[order.payment.method]))}</div>
              ${order.payment.needsChange ? `<div><strong>Troco para:</strong> R$ ${fmt(order.payment.changeFor || 0)}</div>` : ''}
            </div>

            <div class="hr"></div>
            <div><strong>Cliente</strong></div>
            <div>${escapeHtml(order.customer.name)}</div>
            <div class="muted">${escapeHtml(order.customer.phone)}</div>
            <div class="muted">${escapeHtml(order.customer.address)}</div>
            ${order.customer.complement ? `<div class="muted">${escapeHtml(order.customer.complement)}</div>` : ''}

            <div class="hr"></div>
            <div><strong>Itens</strong></div>
            ${itemsHtml}

            <div class="totals">
              <div class="total-line"><span>TOTAL</span><span>R$ ${fmt(order.total)}</span></div>
            </div>

            <div class="hr"></div>
            <div class="center muted">Obrigado pela preferência!</div>
          </div>
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

  const handlePrintBluetooth58 = async (order: Order) => {
    await bt.print58mm({
      storeName: String(settings.name || ''),
      storeAddress: settings.address || undefined,
      order: {
        id: order.id,
        createdAt: order.createdAt,
        seqOfDay: order.seqOfDay,
        tableNumber: order.tableNumber,
        customer: {
          name: order.customer?.name,
          phone: order.customer?.phone,
          address: order.customer?.address,
          complement: order.customer?.complement,
        },
        items: order.items,
        total: order.total,
        payment: {
          method: order.payment?.method,
          needsChange: order.payment?.needsChange,
          changeFor: order.payment?.changeFor,
        },
      },
    });
  };

  const OrderDetails: React.FC<{ order: Order }> = ({ order }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {typeof order.seqOfDay === 'number' && (
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Seq. do dia</p>
            <p className="font-medium font-mono">#{order.seqOfDay}</p>
          </div>
        )}
        {order.tableNumber && (
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Mesa/Comanda</p>
            <p className="font-medium">{order.tableNumber}</p>
          </div>
        )}
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
          {(order.customer as any).reference ? (
            <p className="text-sm text-muted-foreground">Ref: {String((order.customer as any).reference)}</p>
          ) : null}
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
                     {(item as CartItemPizza).note && (
                       <p className="text-sm text-muted-foreground">
                         Obs: <span className="text-foreground">{(item as CartItemPizza).note}</span>
                       </p>
                     )}
                  </>
                ) : (
                  <>
                    <p className="font-medium">{formatProductLabel(item.product.name)}</p>
                    {parseDrinkSize(item.product.name) && (
                      <p className="text-xs text-muted-foreground">(tamanho do refrigerante)</p>
                    )}
                  </>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground">Gerencie os pedidos confirmados</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showOpenInNewTab ? (
            <Button variant="outline" onClick={openInNewTab}>
              <ExternalLink className="w-4 h-4" />
              Abrir em nova aba (impressão)
            </Button>
          ) : null}
          <Button variant="outline" onClick={bt.connect} disabled={bt.connecting}>
            <Bluetooth className="w-4 h-4" />
            {bt.connecting ? 'Conectando...' : 'Conectar Bluetooth (58mm)'}
          </Button>
          {bt.isConnected ? (
            <Button variant="outline" onClick={bt.disconnect}>
              Desconectar
            </Button>
          ) : null}

            <Button
              variant="outline"
              onClick={() => bt.printTest58mm({ storeName: String(settings.name || ''), storeAddress: settings.address || undefined })}
              disabled={!bt.isConnected}
              title={bt.isConnected ? 'Testar impressão Bluetooth (58mm)' : 'Conecte Bluetooth para testar'}
            >
              <Printer className="w-4 h-4" />
              Testar impressão (58mm)
            </Button>
        </div>
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
                      <Card
                        id={`order-${order.id}`}
                        className={isNew ? 'ring-2 ring-secondary ring-offset-2 bg-secondary/5 animate-pulse' : ''}
                      >
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
                              {order.tableNumber && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Mesa/Comanda: <span className="font-medium text-foreground">{order.tableNumber}</span>
                                </p>
                              )}
                              {order.customer.complement && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Obs: <span className="font-medium text-foreground">{order.customer.complement}</span>
                                </p>
                              )}
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

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePrintBluetooth58(order)}
                                title={bt.isConnected ? 'Imprimir Bluetooth (58mm)' : 'Conecte Bluetooth para imprimir'}
                                disabled={!bt.isConnected}
                              >
                                <Bluetooth className="w-4 h-4" />
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
