export type BluetoothPrinter = {
  write: (data: Uint8Array) => Promise<void>;
  name?: string;
};

type Connected = {
  device: any;
  characteristic: any;
};

let connected: Connected | null = null;

const encoder = new TextEncoder();

// Common service/characteristic UUIDs used by many BLE thermal printers
const COMMON_SERVICE_UUIDS: any[] = [
  0xffe0,
  0xff00,
  0x18f0,
  0x49535343, // some printers expose custom 32-bit UUIDs
];

const COMMON_CHAR_UUIDS: any[] = [
  0xffe1,
  0xff01,
  0x2af1,
];

const chunk = async (ch: any, bytes: Uint8Array, mtu = 180) => {
  for (let i = 0; i < bytes.length; i += mtu) {
    const part = bytes.slice(i, i + mtu);
    // Prefer writeValueWithoutResponse when available
    if (typeof (ch as any).writeValueWithoutResponse === 'function') {
      await (ch as any).writeValueWithoutResponse(part);
    } else {
      await ch.writeValue(part);
    }
  }
};

async function findWritableCharacteristic(server: any) {
  // Try common services first
  for (const s of COMMON_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(s);
      for (const c of COMMON_CHAR_UUIDS) {
        try {
          const ch = await service.getCharacteristic(c);
          return ch;
        } catch {
          // continue
        }
      }
      // Fallback: scan all characteristics and pick a writable one
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch {
      // continue
    }
  }

  // Last resort: list all primary services and scan
  const services = await server.getPrimaryServices();
  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function connectBluetoothPrinter(): Promise<BluetoothPrinter> {
  if (!(navigator as any).bluetooth) {
    throw new Error('Bluetooth não suportado neste navegador/dispositivo. Use Chrome/Edge (Android/desktop).');
  }

  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: COMMON_SERVICE_UUIDS,
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error('Não foi possível conectar na impressora (GATT).');

  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) throw new Error('Não encontrei uma característica gravável na impressora Bluetooth.');

  connected = { device, characteristic };

  return {
    name: device.name || undefined,
    write: async (data: Uint8Array) => {
      if (!connected) throw new Error('Impressora não conectada.');
      await chunk(connected.characteristic, data);
    },
  };
}

export function getConnectedPrinterName() {
  return connected?.device?.name || null;
}

export function disconnectBluetoothPrinter() {
  try {
    connected?.device?.gatt?.disconnect();
  } finally {
    connected = null;
  }
}

// -----------------
// ESC/POS builders
// -----------------

export type ReceiptOrderLike = {
  id: string;
  createdAt?: Date | string;
  seqOfDay?: number;
  tableNumber?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    complement?: string;
  };
  items: any[];
  total: number;
  payment?: { method?: string; needsChange?: boolean; changeFor?: number };
};

const ESC = 0x1b;
const GS = 0x1d;

const cmd = (...bytes: number[]) => new Uint8Array(bytes);
const txt = (s: string) => encoder.encode(s);

const pad = (s: string, len: number) => {
  const str = s.length > len ? s.slice(0, len) : s;
  return str + ' '.repeat(Math.max(0, len - str.length));
};

const money = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

export function buildEscPosReceipt58mm(params: {
  storeName: string;
  storeAddress?: string;
  order: ReceiptOrderLike;
}) {
  const W = 32; // ~58mm
  const lines: Uint8Array[] = [];

  // init
  lines.push(cmd(ESC, 0x40));
  // center + bold
  lines.push(cmd(ESC, 0x61, 0x01));
  lines.push(cmd(ESC, 0x45, 0x01));
  lines.push(txt(`${params.storeName}\n`));
  lines.push(cmd(ESC, 0x45, 0x00));
  if (params.storeAddress) lines.push(txt(`${params.storeAddress}\n`));
  lines.push(cmd(ESC, 0x61, 0x00));

  lines.push(txt('-'.repeat(W) + '\n'));

  const idShort = params.order.id.slice(0, 8).toUpperCase();
  lines.push(txt(`Pedido: ${idShort}\n`));
  if (typeof params.order.seqOfDay === 'number') lines.push(txt(`Seq. do dia: ${params.order.seqOfDay}\n`));
  if (params.order.tableNumber) lines.push(txt(`Mesa/Comanda: ${params.order.tableNumber}\n`));

  const createdAt = params.order.createdAt
    ? new Date(params.order.createdAt as any)
    : new Date();
  lines.push(txt(`Data: ${createdAt.toLocaleString('pt-BR')}\n`));
  if (params.order.payment?.method) lines.push(txt(`Pagamento: ${String(params.order.payment.method).toUpperCase()}\n`));
  if (params.order.payment?.needsChange) {
    lines.push(txt(`Troco p/: ${money(params.order.payment.changeFor || 0)}\n`));
  }

  if (params.order.customer?.address) {
    lines.push(txt('-'.repeat(W) + '\n'));
    lines.push(txt('Entrega\n'));
    if (params.order.customer?.name) lines.push(txt(`${params.order.customer.name}\n`));
    if (params.order.customer?.phone) lines.push(txt(`${params.order.customer.phone}\n`));
    lines.push(txt(`${params.order.customer.address}\n`));
    if (params.order.customer?.complement) lines.push(txt(`${params.order.customer.complement}\n`));
  }

  lines.push(txt('-'.repeat(W) + '\n'));
  lines.push(txt('Itens\n'));

  for (const item of params.order.items || []) {
    if (item?.type === 'pizza') {
      const qty = Number(item.quantity || 1);
      const size = String(item.size || '').toUpperCase();
      const flavors = (item.flavors || []).map((f: any) => f?.name).filter(Boolean).join(' + ') || 'Pizza';
      const title = `${qty}x Pizza ${size}`;
      lines.push(txt(title + '\n'));
      lines.push(txt(`  ${flavors}\n`));
      if (item.border?.name) lines.push(txt(`  Borda: ${String(item.border.name)}\n`));
      if (item.note) lines.push(txt(`  Obs: ${String(item.note)}\n`));
      lines.push(txt(`  ${money((item.unitPrice || 0) * qty)}\n`));
      continue;
    }

    const p = item?.product;
    const name = String(p?.name || 'Produto');
    const qty = Number(item?.quantity || 1);
    const price = money((item.unitPrice || 0) * qty);
    const left = `${qty}x ${name}`;
    // split in two lines to preserve price right aligned
    const leftMax = Math.max(8, W - price.length - 1);
    lines.push(txt(pad(left, leftMax) + ' ' + price + '\n'));
  }

  lines.push(txt('-'.repeat(W) + '\n'));
  // bold total
  lines.push(cmd(ESC, 0x45, 0x01));
  const totalLine = `TOTAL ${money(params.order.total)}`;
  lines.push(txt(totalLine + '\n'));
  lines.push(cmd(ESC, 0x45, 0x00));

  lines.push(txt('\n'));
  lines.push(cmd(ESC, 0x61, 0x01));
  lines.push(txt('Obrigado!\n'));
  lines.push(cmd(ESC, 0x61, 0x00));

  // cut (may be ignored)
  lines.push(cmd(GS, 0x56, 0x00));

  // concat
  const totalLen = lines.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of lines) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}
