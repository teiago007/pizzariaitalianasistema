import React, { useEffect, useMemo, useState } from "react";
import { Download, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isIos = () => {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

const isStandalone = () => {
  // iOS: navigator.standalone
  // other: display-mode media query
  const nav = navigator as any;
  return Boolean(nav.standalone) || window.matchMedia?.("(display-mode: standalone)")?.matches;
};

const InstallPage: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canPrompt = !!deferredPrompt;

  const instructions = useMemo(() => {
    if (installed) {
      return {
        title: "App já instalado",
        description: "Este dispositivo já está usando a versão instalável.",
      };
    }

    if (canPrompt) {
      return {
        title: "Instalar no celular",
        description: "Toque em instalar para adicionar à tela inicial (como um app).",
      };
    }

    if (isIos()) {
      return {
        title: "Instalar no iPhone/iPad",
        description: "No Safari: Compartilhar → Adicionar à Tela de Início.",
      };
    }

    return {
      title: "Instalar no celular",
      description: "Abra no Chrome/Edge e use o menu do navegador → Instalar app.",
    };
  }, [installed, canPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">Instalar</h1>
          <p className="text-muted-foreground">Use este link para instalar o sistema como app no celular.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              {instructions.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{instructions.description}</p>

            <Button
              className="w-full"
              onClick={handleInstall}
              disabled={!canPrompt || installed}
              title={installed ? "Já instalado" : canPrompt ? "Instalar" : "Use o menu do navegador"}
            >
              <Download className="w-4 h-4 mr-2" />
              {installed ? "Instalado" : "Instalar agora"}
            </Button>

            {!canPrompt && !installed ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>
                  Se o botão não aparecer, é normal: alguns navegadores só liberam a instalação depois de visitar o site mais de uma vez.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstallPage;
