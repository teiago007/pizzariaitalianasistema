import React, { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Banknote, DoorClosed, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { useCashRegister, type CashMovementType } from "@/hooks/useCashRegister";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const money = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

const StaffCashierPage: React.FC = () => {
  const { openShift, movements, loading, openNewShift, closeShift, addMovement, totals, computedBalance } =
    useCashRegister();

  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [movementType, setMovementType] = useState<CashMovementType>("WITHDRAW");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Caixa</h1>
        <p className="text-muted-foreground">Abra/feche turno e registre sangrias/suprimentos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              Turno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : openShift ? (
              <>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Turno aberto em</p>
                  <p className="font-semibold">{new Date(openShift.opened_at).toLocaleString("pt-BR")}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo inicial</p>
                      <p className="font-semibold">{money(openShift.opening_balance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo calculado</p>
                      <p className="font-semibold">{money(computedBalance)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground">Suprimentos</p>
                    <p className="font-semibold">{money(totals.supplies)}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground">Sangrias</p>
                    <p className="font-semibold">{money(totals.withdraws)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Tipo de movimento</Label>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant={movementType === "WITHDRAW" ? "default" : "outline"}
                        onClick={() => setMovementType("WITHDRAW")}
                        className="gap-2"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Sangria
                      </Button>
                      <Button
                        type="button"
                        variant={movementType === "SUPPLY" ? "default" : "outline"}
                        onClick={() => setMovementType("SUPPLY")}
                        className="gap-2"
                      >
                        <ArrowDownCircle className="w-4 h-4" />
                        Suprimento
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Valor</Label>
                    <Input
                      className="mt-1.5"
                      inputMode="decimal"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <Label>Observação (opcional)</Label>
                  <Input className="mt-1.5" value={movementNote} onChange={(e) => setMovementNote(e.target.value)} />
                </div>

                <Button
                  type="button"
                  onClick={async () => {
                    const amount = Number(movementAmount.replace(",", "."));
                    if (!amount || amount <= 0) {
                      toast.error("Informe um valor válido");
                      return;
                    }
                    try {
                      await addMovement(movementType, amount, movementNote);
                      setMovementAmount("");
                      setMovementNote("");
                      toast.success("Movimento registrado");
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao registrar");
                    }
                  }}
                >
                  Registrar movimento
                </Button>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Saldo de fechamento</Label>
                    <Input
                      className="mt-1.5"
                      inputMode="decimal"
                      value={closingBalance}
                      onChange={(e) => setClosingBalance(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder={money(computedBalance).replace("R$ ", "")}
                    />
                  </div>
                  <div>
                    <Label>Observação do turno (opcional)</Label>
                    <Input className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  onClick={async () => {
                    const amount = Number(closingBalance.replace(",", ".")) || computedBalance;
                    try {
                      await closeShift(amount, note);
                      setClosingBalance("0");
                      setNote("");
                      toast.success("Turno fechado");
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao fechar turno");
                    }
                  }}
                >
                  <DoorClosed className="w-4 h-4" />
                  Fechar turno
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum turno aberto.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Saldo inicial</Label>
                    <Input
                      className="mt-1.5"
                      inputMode="decimal"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Observação (opcional)</Label>
                    <Input className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={async () => {
                    const amount = Number(openingBalance.replace(",", "."));
                    if (amount < 0) {
                      toast.error("Valor inválido");
                      return;
                    }
                    try {
                      await openNewShift(amount || 0, note);
                      setNote("");
                      toast.success("Turno aberto");
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || "Erro ao abrir turno");
                    }
                  }}
                >
                  <DoorOpen className="w-4 h-4" />
                  Abrir turno
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Movimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!openShift ? (
              <p className="text-sm text-muted-foreground">Abra um turno para ver movimentos.</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum movimento ainda.</p>
            ) : (
              movements.slice(0, 20).map((m) => (
                <div key={m.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {m.type === "SUPPLY" ? "Suprimento" : m.type === "WITHDRAW" ? "Sangria" : "Venda"}
                    </p>
                    <p className="font-semibold">{money(m.amount)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
                  {m.note ? <p className="text-sm mt-2">{m.note}</p> : null}
                </div>
              ))
            )}
            {movements.length > 20 ? <p className="text-xs text-muted-foreground">Mostrando últimos 20.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffCashierPage;
