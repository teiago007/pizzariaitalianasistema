import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Store, Palette, MapPin, Phone, Upload, CreditCard, Loader2, Clock, CalendarDays, Trash2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type StoreHourRow = {
  id: string;
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
};

type StoreExceptionRow = {
  id: string;
  exception_date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
};

const dayLabels: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

const timeToInput = (t: string | null) => (t ? t.slice(0, 5) : '');
const inputToTime = (t: string) => (t ? `${t}:00` : null);

const AdminSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings, loading, updateSettings, uploadLogo } = useSettings();
  const [formData, setFormData] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: storeHours } = useQuery({
    queryKey: ['store-hours-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_hours')
        .select('*')
        .order('day_of_week', { ascending: true });
      if (error) throw error;
      return (data || []) as StoreHourRow[];
    },
  });

  const { data: storeExceptions } = useQuery({
    queryKey: ['store-exceptions-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_exceptions')
        .select('*')
        .order('exception_date', { ascending: false });
      if (error) throw error;
      return (data || []) as StoreExceptionRow[];
    },
  });

  const weekly = useMemo(() => {
    // Guarantee 0..6
    const map = new Map<number, StoreHourRow>();
    (storeHours || []).forEach((h) => map.set(h.day_of_week, h));
    return Array.from({ length: 7 }, (_, i) =>
      map.get(i) || {
        id: `missing-${i}`,
        day_of_week: i,
        is_closed: true,
        open_time: null,
        close_time: null,
      }
    );
  }, [storeHours]);

  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      // garante que a tela reflita o que ficou persistido
      await queryClient.invalidateQueries({ queryKey: ['pizzeria-settings'] });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await uploadLogo(file);
    if (url) {
      setFormData(prev => ({ ...prev, logo: url }));
    }
    setIsUploading(false);
  };

  const upsertStoreHour = async (row: StoreHourRow) => {
    const payload = {
      day_of_week: row.day_of_week,
      is_closed: row.is_closed,
      open_time: row.is_closed ? null : row.open_time,
      close_time: row.is_closed ? null : row.close_time,
    };

    const { error } = await supabase
      .from('store_hours')
      .upsert(payload, { onConflict: 'day_of_week' });

    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['store-hours-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['store-hours'] });
  };

  const createOrUpdateException = async (payload: Omit<StoreExceptionRow, 'id'>) => {
    const { error } = await supabase
      .from('store_exceptions')
      .upsert(payload, { onConflict: 'exception_date' });
    if (error) throw error;

    await queryClient.invalidateQueries({ queryKey: ['store-exceptions-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['store-exceptions'] });
  };

  const deleteException = async (id: string) => {
    const { error } = await supabase.from('store_exceptions').delete().eq('id', id);
    if (error) throw error;

    await queryClient.invalidateQueries({ queryKey: ['store-exceptions-admin'] });
    await queryClient.invalidateQueries({ queryKey: ['store-exceptions'] });
  };

  const [exceptionForm, setExceptionForm] = useState({
    exception_date: '',
    is_closed: true,
    open_time: '',
    close_time: '',
    note: '',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configure as informações da pizzaria</p>
      </div>

      <div className="grid gap-6">
        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Informações da Loja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Pizzaria</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-4 mt-1.5">
                {formData.logo && (
                  <img src={formData.logo} alt="Logo" className="w-16 h-16 object-contain rounded" />
                )}
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{isUploading ? 'Enviando...' : 'Upload Logo'}</span>
                  </div>
                  <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </Label>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-base font-semibold">Status da Pizzaria</Label>
                <p className="text-sm text-muted-foreground">
                  {formData.isOpen ? 'Aberta para pedidos' : 'Fechada no momento'}
                </p>
              </div>
              <Switch
                checked={formData.isOpen}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOpen: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Opening Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Horário de Funcionamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fuso horário: <span className="font-medium text-foreground">America/Sao_Paulo</span>
            </p>

            <div className="space-y-3">
              {weekly.map((row) => (
                <div key={row.day_of_week} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{dayLabels[row.day_of_week]}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.is_closed
                          ? 'Fechado'
                          : `${timeToInput(row.open_time)}–${timeToInput(row.close_time)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Label className="text-sm text-muted-foreground">Fechado</Label>
                      <Switch
                        checked={row.is_closed}
                        onCheckedChange={async (checked) => {
                          try {
                            await upsertStoreHour({
                              ...row,
                              is_closed: checked,
                              open_time: checked ? null : (row.open_time || '18:00:00'),
                              close_time: checked ? null : (row.close_time || '21:00:00'),
                            });
                            toast.success('Horário atualizado');
                          } catch (e) {
                            console.error(e);
                            toast.error('Erro ao atualizar horário');
                          }
                        }}
                      />
                    </div>
                  </div>

                  {!row.is_closed && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <Label>Abertura</Label>
                        <Input
                          type="time"
                          value={timeToInput(row.open_time)}
                          onChange={async (e) => {
                            try {
                              await upsertStoreHour({
                                ...row,
                                open_time: inputToTime(e.target.value),
                              });
                            } catch (err) {
                              console.error(err);
                              toast.error('Erro ao salvar');
                            }
                          }}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Fechamento</Label>
                        <Input
                          type="time"
                          value={timeToInput(row.close_time)}
                          onChange={async (e) => {
                            try {
                              await upsertStoreHour({
                                ...row,
                                close_time: inputToTime(e.target.value),
                              });
                            } catch (err) {
                              console.error(err);
                              toast.error('Erro ao salvar');
                            }
                          }}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exceptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-secondary" />
              Exceções (Datas Específicas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/20">
              <p className="font-semibold mb-3">Adicionar / atualizar exceção</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={exceptionForm.exception_date}
                    onChange={(e) => setExceptionForm((p) => ({ ...p, exception_date: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-base font-semibold">Fechado</Label>
                    <p className="text-sm text-muted-foreground">Marque para fechar a loja nessa data</p>
                  </div>
                  <Switch
                    checked={exceptionForm.is_closed}
                    onCheckedChange={(checked) =>
                      setExceptionForm((p) => ({ ...p, is_closed: checked }))
                    }
                  />
                </div>

                {!exceptionForm.is_closed && (
                  <>
                    <div>
                      <Label>Abertura</Label>
                      <Input
                        type="time"
                        value={exceptionForm.open_time}
                        onChange={(e) => setExceptionForm((p) => ({ ...p, open_time: e.target.value }))}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Fechamento</Label>
                      <Input
                        type="time"
                        value={exceptionForm.close_time}
                        onChange={(e) => setExceptionForm((p) => ({ ...p, close_time: e.target.value }))}
                        className="mt-1.5"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <Label>Observação (opcional)</Label>
                  <Input
                    value={exceptionForm.note}
                    onChange={(e) => setExceptionForm((p) => ({ ...p, note: e.target.value }))}
                    className="mt-1.5"
                    placeholder="Feriado, evento, etc."
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button
                  type="button"
                  onClick={async () => {
                    if (!exceptionForm.exception_date) {
                      toast.error('Selecione uma data');
                      return;
                    }

                    try {
                      await createOrUpdateException({
                        exception_date: exceptionForm.exception_date,
                        is_closed: exceptionForm.is_closed,
                        open_time: exceptionForm.is_closed ? null : inputToTime(exceptionForm.open_time),
                        close_time: exceptionForm.is_closed ? null : inputToTime(exceptionForm.close_time),
                        note: exceptionForm.note ? exceptionForm.note : null,
                      });
                      toast.success('Exceção salva');
                      setExceptionForm({
                        exception_date: '',
                        is_closed: true,
                        open_time: '',
                        close_time: '',
                        note: '',
                      });
                    } catch (e) {
                      console.error(e);
                      toast.error('Erro ao salvar exceção');
                    }
                  }}
                >
                  Salvar Exceção
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {(storeExceptions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma exceção cadastrada.</p>
              ) : (
                (storeExceptions || []).map((ex) => (
                  <div key={ex.id} className="p-4 border rounded-lg bg-card flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(
                          new Date(`${ex.exception_date}T00:00:00-03:00`)
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ex.is_closed
                          ? 'Fechado'
                          : `${timeToInput(ex.open_time)}–${timeToInput(ex.close_time)}`}
                        {ex.note ? ` • ${ex.note}` : ''}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          await deleteException(ex.id);
                          toast.success('Exceção removida');
                        } catch (e) {
                          console.error(e);
                          toast.error('Erro ao remover');
                        }
                      }}
                      aria-label="Remover exceção"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* PIX Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-secondary" />
              Configurações do PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pixKey">Chave PIX (CPF/CNPJ/Email/Telefone)</Label>
              <Input
                id="pixKey"
                value={formData.pixKey || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, pixKey: e.target.value }))}
                placeholder="Sua chave PIX"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="pixName">Nome do Recebedor</Label>
              <Input
                id="pixName"
                value={formData.pixName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, pixName: e.target.value }))}
                placeholder="Nome que aparece no PIX"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-secondary" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" />
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="address">Endereço Completo</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Cores do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Cor Principal</Label>
                <div className="flex gap-2 mt-1.5">
                  <input type="color" value={formData.primaryColor} onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))} className="w-12 h-10 rounded cursor-pointer" />
                  <Input value={formData.primaryColor} onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Cor Secundária</Label>
                <div className="flex gap-2 mt-1.5">
                  <input type="color" value={formData.secondaryColor} onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))} className="w-12 h-10 rounded cursor-pointer" />
                  <Input value={formData.secondaryColor} onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Cor de Destaque</Label>
                <div className="flex gap-2 mt-1.5">
                  <input type="color" value={formData.accentColor} onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))} className="w-12 h-10 rounded cursor-pointer" />
                  <Input value={formData.accentColor} onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;