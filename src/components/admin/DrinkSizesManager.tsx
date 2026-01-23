import React, { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type DrinkSizeRow = {
  id: string;
  name: string;
  display_order: number;
  available: boolean;
};

const DrinkSizesManager: React.FC = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DrinkSizeRow | null>(null);
  const [form, setForm] = useState({ name: "", display_order: 0, available: true });

  const { data: sizes = [], isLoading } = useQuery({
    queryKey: ["drink-sizes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drink_sizes")
        .select("id,name,display_order,available")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data || []) as DrinkSizeRow[];
    },
  });

  const ordered = useMemo(() => [...sizes].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)), [sizes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        display_order: Number(form.display_order) || 0,
        available: Boolean(form.available),
      };
      if (!payload.name) throw new Error("Nome é obrigatório");

      if (editing) {
        const { error } = await supabase.from("drink_sizes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drink_sizes").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drink-sizes-admin"] });
      qc.invalidateQueries({ queryKey: ["drink-sizes-public"] });
      toast.success(editing ? "Tamanho atualizado!" : "Tamanho criado!");
      setOpen(false);
      setEditing(null);
      setForm({ name: "", display_order: 0, available: true });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar tamanho"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drink_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drink-sizes-admin"] });
      qc.invalidateQueries({ queryKey: ["drink-sizes-public"] });
      toast.success("Tamanho removido!");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover tamanho"),
  });

  const openDialog = (row?: DrinkSizeRow) => {
    if (row) {
      setEditing(row);
      setForm({ name: row.name, display_order: row.display_order, available: row.available });
    } else {
      setEditing(null);
      setForm({ name: "", display_order: 0, available: true });
    }
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tamanhos de refrigerante</h2>
          <p className="text-sm text-muted-foreground">Ex: Lata, 600ml, 1L, 2L</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo tamanho
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordered.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    <p className="text-sm text-muted-foreground">Ordem: {s.display_order}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-2 ${s.available ? "bg-green-500" : "bg-red-500"}`} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDialog(s)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Excluir este tamanho? (Produtos associados ficarão sem tamanho)")) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tamanho" : "Novo tamanho"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Ordem de exibição</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.available} onCheckedChange={(checked) => setForm((f) => ({ ...f, available: checked }))} />
              <Label>Ativo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrinkSizesManager;
