import React from "react";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StaffOrdersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Atendimento</h1>
        <p className="text-muted-foreground">Crie pedidos usando o mesmo fluxo do cliente e acompanhe os seus pedidos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Novo pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abrir o cardápio, adicionar itens, personalizar e finalizar.
            </p>
            <Link to="/cardapio">
              <Button className="gap-2">
                Ir para o cardápio <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Meus pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em seguida eu implemento aqui a listagem com filtros por data e horário (pedidos criados no seu login).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffOrdersPage;
