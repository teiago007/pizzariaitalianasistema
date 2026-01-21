import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PizzeriaSettings } from '@/types';
import { toast } from 'sonner';

interface DbSettings {
  id: string;
  name: string;
  logo_url: string | null;
  is_open: boolean;
  whatsapp: string;
  address: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  pix_key: string | null;
  pix_name: string | null;
  created_at: string;
  updated_at: string;
}

const mapDbToSettings = (db: DbSettings): PizzeriaSettings & { id: string; pixKey?: string; pixName?: string } => ({
  id: db.id,
  name: db.name,
  logo: db.logo_url || undefined,
  isOpen: db.is_open,
  whatsapp: db.whatsapp,
  address: db.address,
  primaryColor: db.primary_color,
  secondaryColor: db.secondary_color,
  accentColor: db.accent_color,
  pixKey: db.pix_key || undefined,
  pixName: db.pix_name || undefined,
});

export function useSettings() {
  const [settings, setSettings] = useState<PizzeriaSettings & { id?: string; pixKey?: string; pixName?: string }>({
    name: 'Pizzaria Italiana',
    isOpen: true,
    whatsapp: '(89) 98134-7052',
    address: 'Avenida Manoel Bezerra | Nº189 | Centro',
    primaryColor: '#C41E3A',
    secondaryColor: '#228B22',
    accentColor: '#FFFFFF',
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pizzeria_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(mapDbToSettings(data as DbSettings));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<PizzeriaSettings & { pixKey?: string; pixName?: string }>) => {
    try {
      // Garante payload completo para INSERT quando ainda não existir registro
      const merged = { ...settings, ...updates };

      const dbUpdates: any = {
        name: merged.name,
        is_open: merged.isOpen,
        whatsapp: merged.whatsapp,
        address: merged.address,
        primary_color: merged.primaryColor,
        secondary_color: merged.secondaryColor,
        accent_color: merged.accentColor,
        logo_url: merged.logo ?? null,
        pix_key: merged.pixKey ?? null,
        pix_name: merged.pixName ?? null,
      };

      if (settings.id) {
        const { data, error } = await supabase
          .from('pizzeria_settings')
          .update(dbUpdates)
          .eq('id', settings.id)
          .select('*')
          .maybeSingle();

        if (error) throw error;

        // Se o backend devolver a linha atualizada, usamos ela como fonte da verdade
        if (data) {
          setSettings(mapDbToSettings(data as DbSettings));
        } else {
          setSettings((prev) => ({ ...prev, ...updates }));
        }
      } else {
        const { data, error } = await supabase
          .from('pizzeria_settings')
          .insert(dbUpdates)
          .select('*')
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings(mapDbToSettings(data as DbSettings));
        } else {
          // fallback (não esperado), mas mantém UI consistente
          setSettings((prev) => ({ ...prev, ...updates }));
        }
      }

      toast.success('Configurações salvas');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao fazer upload do logo');
      return null;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    uploadLogo,
    refetch: fetchSettings,
  };
}