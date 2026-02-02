import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buildEscPosReceipt58mm, type ReceiptOrderLike } from "@/lib/escpos";
import {
  connectUsbEscPosPrinter,
  disconnectUsbEscPosPrinter,
  getConnectedUsbPrinterName,
  type UsbEscPosPrinter,
} from "@/lib/webusb-escpos";

export function useUsbEscposPrinter() {
  const printerRef = useRef<UsbEscPosPrinter | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectedName, setConnectedName] = useState<string | null>(getConnectedUsbPrinterName());

  const isConnected = !!connectedName;

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      const p = await connectUsbEscPosPrinter();
      printerRef.current = p;
      setConnectedName(p.name || getConnectedUsbPrinterName() || "Impressora USB");
      toast.success(`Impressora USB conectada${p.name ? `: ${p.name}` : ""}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao conectar na impressora USB");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectUsbEscPosPrinter();
    printerRef.current = null;
    setConnectedName(null);
    toast.success("Impressora USB desconectada");
  }, []);

  const print58mm = useCallback(
    async (params: { storeName: string; storeAddress?: string; order: ReceiptOrderLike }) => {
      try {
        const current = printerRef.current;
        if (!current || !connectedName) {
          toast.error("Conecte a impressora USB primeiro");
          return false;
        }

        const bytes = buildEscPosReceipt58mm({
          storeName: params.storeName,
          storeAddress: params.storeAddress,
          order: params.order,
        });

        await current.write(bytes);
        toast.success("Enviado para impressora (USB)");
        return true;
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Erro ao imprimir via USB");
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
          id: "TESTE0000",
          createdAt: new Date(),
          items: [
            {
              type: "product",
              id: "test-item",
              quantity: 1,
              unitPrice: 0,
              product: {
                id: "test",
                name: "*** TESTE DE IMPRESSAO (USB) ***",
                description: "",
                price: 0,
                category: "Teste",
                available: true,
              },
            },
          ],
          total: 0,
          payment: { method: "teste" },
        },
      });
    },
    [print58mm]
  );

  const statusLabel = useMemo(() => {
    if (!connectedName) return "USB: desconectado";
    return `USB: ${connectedName}`;
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
