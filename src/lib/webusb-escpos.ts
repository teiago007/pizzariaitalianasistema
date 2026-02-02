export type UsbEscPosPrinter = {
  write: (data: Uint8Array) => Promise<void>;
  name?: string;
};

type Connected = {
  device: any;
  interfaceNumber: number;
  endpointOut: number;
};

let connected: Connected | null = null;

function assertTopLevelContext() {
  try {
    if (typeof window !== "undefined" && window.self !== window.top) {
      throw new Error(
        "Impressão USB (WebUSB) não funciona dentro do preview. Abra o sistema em uma nova aba (ou use o app instalado/PWA) e tente novamente."
      );
    }
  } catch {
    throw new Error(
      "Impressão USB (WebUSB) não funciona dentro do preview. Abra o sistema em uma nova aba (ou use o app instalado/PWA) e tente novamente."
    );
  }
}

function pickPrinterInterface(device: any): { interfaceNumber: number; endpointOut: number } {
  const cfg = device?.configuration;
  const ifaces = cfg?.interfaces || [];

  for (const iface of ifaces) {
    for (const alt of iface.alternates || []) {
      const endpoints = alt.endpoints || [];
      const outEp = endpoints.find((e: any) => e.direction === "out" && e.type === "bulk");
      if (outEp) {
        return { interfaceNumber: iface.interfaceNumber, endpointOut: outEp.endpointNumber };
      }
    }
  }

  // fallback: any OUT endpoint
  for (const iface of ifaces) {
    for (const alt of iface.alternates || []) {
      const endpoints = alt.endpoints || [];
      const outEp = endpoints.find((e: any) => e.direction === "out");
      if (outEp) {
        return { interfaceNumber: iface.interfaceNumber, endpointOut: outEp.endpointNumber };
      }
    }
  }

  throw new Error(
    "Não encontrei um endpoint USB de saída para a impressora. (Alguns modelos não suportam WebUSB no navegador.)"
  );
}

export function getConnectedUsbPrinterName() {
  return connected?.device?.productName || connected?.device?.manufacturerName || null;
}

export async function connectUsbEscPosPrinter(): Promise<UsbEscPosPrinter> {
  assertTopLevelContext();

  const usb = (navigator as any)?.usb;
  if (!usb) {
    throw new Error(
      "WebUSB não suportado neste navegador/dispositivo. Use Chrome/Edge no desktop (HTTPS)."
    );
  }

  // Request a USB device. Many thermal printers present as USB printer class (0x07).
  // This is best-effort: some printers won't appear or won't allow WebUSB transfers.
  let device: any;
  try {
    device = await usb.requestDevice({
      filters: [{ classCode: 0x07 }],
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (e?.name === "NotFoundError" || /no device selected/i.test(msg)) {
      throw new Error("Seleção de impressora cancelada.");
    }
    throw e;
  }

  if (!device) throw new Error("Nenhuma impressora selecionada.");

  await device.open();
  if (!device.configuration) {
    await device.selectConfiguration(1);
  }

  const { interfaceNumber, endpointOut } = pickPrinterInterface(device);

  try {
    await device.claimInterface(interfaceNumber);
  } catch (e) {
    console.error("USB claimInterface failed", e);
    throw new Error(
      "Não foi possível habilitar a impressora via USB no navegador. Verifique permissões/driver e tente reconectar."
    );
  }

  connected = { device, interfaceNumber, endpointOut };

  return {
    name: device.productName || device.manufacturerName || undefined,
    write: async (data: Uint8Array) => {
      if (!connected) throw new Error("Impressora USB não conectada.");
      const res = await connected.device.transferOut(connected.endpointOut, data);
      if (res?.status && res.status !== "ok") {
        throw new Error(`Falha ao enviar dados para USB: ${String(res.status)}`);
      }
    },
  };
}

export async function disconnectUsbEscPosPrinter() {
  try {
    if (connected?.device?.opened) {
      await connected.device.close();
    }
  } finally {
    connected = null;
  }
}
