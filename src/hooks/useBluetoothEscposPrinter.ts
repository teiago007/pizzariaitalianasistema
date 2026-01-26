import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildEscPosReceipt58mm,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getConnectedPrinterName,
  type BluetoothPrinter,
  type ReceiptOrderLike,
} from "@/lib/escpos";

export function useBluetoothEscposPrinter() {
  const printerRef = useRef<BluetoothPrinter | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectedName, setConnectedName] = useState<string | null>(getConnectedPrinterName());

  const isConnected = !!connectedName;

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      const p = await connectBluetoothPrinter();
      printerRef.current = p;
      setConnectedName(p.name || getConnectedPrinterName() || "Impressora");
      toast.success(`Impressora conectada${p.name ? `: ${p.name}` : ""}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao conectar na impressora");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectBluetoothPrinter();
    printerRef.current = null;
    setConnectedName(null);
    toast.success("Impressora desconectada");
  }, []);

  const print58mm = useCallback(
    async (params: { storeName: string; storeAddress?: string; order: ReceiptOrderLike }) => {
      try {
        const current = printerRef.current;
        if (!current || !connectedName) {
          toast.error("Conecte uma impressora Bluetooth primeiro");
          return false;
        }

        const bytes = buildEscPosReceipt58mm({
          storeName: params.storeName,
          storeAddress: params.storeAddress,
          order: params.order,
        });

        await current.write(bytes);
        toast.success("Enviado para impressora (58mm)");
        return true;
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Erro ao imprimir via Bluetooth");
        return false;
      }
    },
    [connectedName]
  );

  const printTest58mm = useCallback(
    async (params: { storeName: string; storeAddress?: string }) => {
      return print58mm({
        storeName: params.storeName,
        storeAddress: params.storeAddress,
        order: {
          id: 'TESTE0000',
          createdAt: new Date(),
          items: [
            {
              type: 'product',
              id: 'test-item',
              quantity: 1,
              unitPrice: 0,
              product: {
                id: 'test',
                name: '*** TESTE DE IMPRESSAO (58mm) ***',
                description: '',
                price: 0,
                category: 'Teste',
                available: true,
              },
            },
          ],
          total: 0,
          payment: { method: 'teste' },
        },
      });
    },
    [print58mm]
  );

  const statusLabel = useMemo(() => {
    if (!connectedName) return "Bluetooth: desconectado";
    return `Bluetooth: ${connectedName}`;
  }, [connectedName]);

  return {
    isConnected,
    connectedName,
    connecting,
    statusLabel,
    connect,
    disconnect,
    print58mm,
    printTest58mm,
  };
}
