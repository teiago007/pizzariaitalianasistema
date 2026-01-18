import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LAST_ORDER_ID_KEY = "lastOrderId";

const TrackOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const lastOrderId = useMemo(() => {
    try {
      return localStorage.getItem(LAST_ORDER_ID_KEY) || "";
    } catch {
      return "";
    }
  }, []);

  const handleGo = (orderId: string) => {
    const clean = orderId.trim();
    if (!clean) return;
    navigate(`/pedido/${clean}`);
  };

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao início
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground">Acompanhar Pedido</h1>
          <p className="text-muted-foreground">
            Você pode sair e voltar quando quiser. Vamos guardar seu último pedido neste dispositivo.
          </p>
        </motion.div>

        {lastOrderId && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Último pedido</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{lastOrderId}</p>
                <p className="text-xs text-muted-foreground">Clique para continuar acompanhando</p>
              </div>
              <Button onClick={() => handleGo(lastOrderId)}>
                Ver
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Informar ID do pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="orderId">ID do pedido</Label>
              <Input
                id="orderId"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Cole aqui o ID completo (UUID)"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Dica: se você clicou em “Acompanhar Pedido” após pagar, a opção acima (Último pedido) já resolve.
              </p>
            </div>

            <Button className="w-full" onClick={() => handleGo(value)} disabled={!value.trim()}>
              Acompanhar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrackOrderPage;
