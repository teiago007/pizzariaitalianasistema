import React, { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type DrinkSize = { id: string; name: string; available: boolean; display_order: number };
type DbProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
  image_url: string | null;
  drink_size_id: string | null;
};

const formSchema = z.object({
  templateProductId: z.string().uuid({ message: "Selecione um produto template" }),
  targetDrinkSizeId: z.string().uuid({ message: "Selecione o tamanho de destino" }),
  namesRaw: z
    .string()
    .trim()
    .min(1, { message: "Informe ao menos um refrigerante (um por linha)" })
    .max(2000, { message: "Lista muito grande" }),
});

const normalizeNames = (raw: string) => {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // remove duplicados mantendo ordem
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const n of lines) {
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
  }
  return unique;
};

const isSodaProduct = (p: { category: string; name: string }) => {
  const c = (p.category || "").toLowerCase();
  const n = (p.name || "").toLowerCase();
  return c === "refrigerantes" || n.includes("refrigerante");
};

const DrinkProductsDuplicator: React.FC = () => {
  const queryClient = useQueryClient();
  const [templateProductId, setTemplateProductId] = useState<string>("");
  const [targetDrinkSizeId, setTargetDrinkSizeId] = useState<string>("");
  const [namesRaw, setNamesRaw] = useState<string>("Coca-Cola\nGuaraná\nFanta Laranja\nSprite");
  const [submitting, setSubmitting] = useState(false);

  const { data: drinkSizes = [], isLoading: loadingSizes } = useQuery({
    queryKey: ["drink-sizes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drink_sizes")
        .select("id,name,available,display_order")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data || []) as DrinkSize[];
    },
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,price,category,available,image_url,drink_size_id")
        .order("category")
        .order("name");
      if (error) throw error;
      return (data || []) as DbProduct[];
    },
  });

  const templateOptions = useMemo(() => {
    const sodas = products.filter((p) => p.available && isSodaProduct(p));
    return sodas;
  }, [products]);

  const templateProduct = useMemo(
    () => templateOptions.find((p) => p.id === templateProductId) || null,
    [templateOptions, templateProductId]
  );

  const names = useMemo(() => normalizeNames(namesRaw), [namesRaw]);

  const handleDuplicate = async () => {
    const parsed = formSchema.safeParse({ templateProductId, targetDrinkSizeId, namesRaw });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Verifique os campos");
      return;
    }

    if (!templateProduct) {
      toast.error("Produto template não encontrado");
      return;
    }

    const safeNames = names
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 200);

    const invalid = safeNames.find((n) => n.length > 80);
    if (invalid) {
      toast.error("Nome muito longo (máx 80 caracteres)");
      return;
    }

    setSubmitting(true);
    try {
      const payload = safeNames.map((name) => ({
        name,
        description: templateProduct.description || null,
        price: Number(templateProduct.price) || 0,
        category: "Refrigerantes",
        available: true,
        image_url: templateProduct.image_url || null,
        drink_size_id: targetDrinkSizeId,
      }));

      const { error } = await supabase.from("products").insert(payload as any);
      if (error) throw error;

      toast.success(`Criados ${payload.length} refrigerante(s)!`);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) {
      toast.error(`Erro ao duplicar: ${e?.message || "Erro desconhecido"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Duplicar refrigerantes por tamanho</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um produto template (usa preço/descrição/imagem) e crie vários refrigerantes no tamanho de destino.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Produto template</Label>
              <Select value={templateProductId} onValueChange={setTemplateProductId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProducts ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateProduct && (
                <p className="text-xs text-muted-foreground mt-1">
                  Preço: R$ {Number(templateProduct.price || 0).toFixed(2)} • Categoria atual: {templateProduct.category}
                </p>
              )}
            </div>

            <div>
              <Label>Tamanho de destino</Label>
              <Select value={targetDrinkSizeId} onValueChange={setTargetDrinkSizeId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingSizes ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {drinkSizes
                    .filter((s) => s.available)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label>Novos refrigerantes (1 por linha)</Label>
              <span className="text-xs text-muted-foreground">{names.length} item(ns)</span>
            </div>
            <Textarea
              value={namesRaw}
              onChange={(e) => setNamesRaw(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Ex:\nCoca-Cola\nGuaraná\nFanta Laranja"
              className="mt-1.5"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              onClick={handleDuplicate}
              disabled={submitting || !templateProductId || !targetDrinkSizeId || names.length === 0}
            >
              {submitting ? "Criando..." : "Duplicar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm">Dica rápida</Label>
          <p className="text-sm text-muted-foreground">
            Depois de duplicar, você pode ajustar preço/imagem de itens específicos no Admin → Produtos → Outros.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrinkProductsDuplicator;
