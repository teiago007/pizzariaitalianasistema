import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PizzaCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  available: boolean;
  created_at: string;
  updated_at: string;
}

const PizzaCategoriesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PizzaCategory | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    display_order: 0,
    available: true,
  });

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['pizza-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pizza_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as PizzaCategory[];
    },
  });

  // Save category mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PizzaCategory>) => {
      if (editingCategory) {
        const { error } = await supabase
          .from('pizza_categories')
          .update(data)
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pizza_categories')
          .insert([data as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pizza-categories'] });
      toast.success(editingCategory ? 'Categoria atualizada!' : 'Categoria criada!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar categoria: ' + error.message);
    },
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pizza_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pizza-categories'] });
      toast.success('Categoria excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir categoria: ' + error.message);
    },
  });

  const resetForm = () => {
    setEditingCategory(null);
    setForm({
      name: '',
      description: '',
      display_order: categories.length,
      available: true,
    });
  };

  const openDialog = (category?: PizzaCategory) => {
    if (category) {
      setEditingCategory(category);
      setForm({
        name: category.name,
        description: category.description || '',
        display_order: category.display_order,
        available: category.available,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name) {
      toast.error('Nome é obrigatório');
      return;
    }
    saveMutation.mutate({
      name: form.name,
      description: form.description || null,
      display_order: form.display_order,
      available: form.available,
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma categoria criada ainda
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${
                          category.available ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openDialog(category)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Excluir esta categoria? As pizzas vinculadas ficarão sem categoria.')) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Pizzas Especiais"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Nossas pizzas mais pedidas"
              />
            </div>

            <div>
              <Label>Ordem de Exibição</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm(f => ({ ...f, display_order: Number(e.target.value) }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.available}
                onCheckedChange={(checked) => setForm(f => ({ ...f, available: checked }))}
              />
              <Label>Disponível</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PizzaCategoriesManager;
