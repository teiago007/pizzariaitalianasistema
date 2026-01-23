import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PizzaFlavor, PizzaBorder, Product, PizzaSize } from '@/types';
import { toast } from 'sonner';

interface DbFlavor {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  image_url: string | null;
  price_p: number;
  price_m: number;
  price_g: number;
  price_gg: number;
  available: boolean;
  created_at: string;
  updated_at: string;
}

interface DbBorder {
  id: string;
  name: string;
  price: number;
  available: boolean;
  created_at: string;
}

interface DbProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  available: boolean;
  drink_size_id?: string | null;
  drink_size?: { id: string; name: string; available: boolean } | null;
  created_at: string;
  updated_at: string;
}

const mapDbToFlavor = (db: DbFlavor): PizzaFlavor => ({
  id: db.id,
  name: db.name,
  description: db.description || '',
  ingredients: db.ingredients || [],
  image: db.image_url || undefined,
  prices: {
    P: Number(db.price_p),
    M: Number(db.price_m),
    G: Number(db.price_g),
    GG: Number(db.price_gg),
  },
});

const mapDbToBorder = (db: DbBorder): PizzaBorder => ({
  id: db.id,
  name: db.name,
  price: Number(db.price),
});

const mapDbToProduct = (db: DbProduct): Product => ({
  id: db.id,
  name: db.name,
  description: db.description || '',
  price: Number(db.price),
  category: db.category,
  image: db.image_url || undefined,
  available: db.available,
  drinkSizeId: db.drink_size_id ?? null,
  drinkSizeName: db.drink_size?.name ?? null,
});

export function useProducts() {
  const [flavors, setFlavors] = useState<PizzaFlavor[]>([]);
  const [borders, setBorders] = useState<PizzaBorder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [flavorsRes, bordersRes, productsRes] = await Promise.all([
        supabase.from('pizza_flavors').select('*').eq('available', true).order('name'),
        supabase.from('pizza_borders').select('*').eq('available', true).order('name'),
        supabase
          .from('products')
          .select('*, drink_size:drink_sizes(id,name,available)')
          .eq('available', true)
          .order('name'),
      ]);

      if (flavorsRes.error) throw flavorsRes.error;
      if (bordersRes.error) throw bordersRes.error;
      if (productsRes.error) throw productsRes.error;

      setFlavors((flavorsRes.data as DbFlavor[]).map(mapDbToFlavor));
      setBorders((bordersRes.data as DbBorder[]).map(mapDbToBorder));
      setProducts((productsRes.data as DbProduct[]).map(mapDbToProduct));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    flavors,
    borders,
    products,
    loading,
    refetch: fetchAll,
  };
}

export function useAdminProducts() {
  const [flavors, setFlavors] = useState<PizzaFlavor[]>([]);
  const [borders, setBorders] = useState<PizzaBorder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [flavorsRes, bordersRes, productsRes] = await Promise.all([
        supabase.from('pizza_flavors').select('*').order('name'),
        supabase.from('pizza_borders').select('*').order('name'),
        supabase.from('products').select('*, drink_size:drink_sizes(id,name,available)').order('name'),
      ]);

      if (flavorsRes.error) throw flavorsRes.error;
      if (bordersRes.error) throw bordersRes.error;
      if (productsRes.error) throw productsRes.error;

      setFlavors((flavorsRes.data as DbFlavor[]).map(mapDbToFlavor));
      setBorders((bordersRes.data as DbBorder[]).map(mapDbToBorder));
      setProducts((productsRes.data as DbProduct[]).map(mapDbToProduct));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Flavor CRUD
  const addFlavor = async (flavor: Omit<PizzaFlavor, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('pizza_flavors')
        .insert({
          name: flavor.name,
          description: flavor.description,
          ingredients: flavor.ingredients,
          image_url: flavor.image,
          price_p: flavor.prices.P,
          price_m: flavor.prices.M,
          price_g: flavor.prices.G,
          price_gg: flavor.prices.GG,
        })
        .select()
        .single();

      if (error) throw error;

      setFlavors(prev => [...prev, mapDbToFlavor(data as DbFlavor)]);
      toast.success('Sabor adicionado');
      return data.id;
    } catch (error) {
      console.error('Error adding flavor:', error);
      toast.error('Erro ao adicionar sabor');
      return null;
    }
  };

  const updateFlavor = async (id: string, updates: Partial<PizzaFlavor>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.ingredients) dbUpdates.ingredients = updates.ingredients;
      if (updates.image !== undefined) dbUpdates.image_url = updates.image;
      if (updates.prices) {
        dbUpdates.price_p = updates.prices.P;
        dbUpdates.price_m = updates.prices.M;
        dbUpdates.price_g = updates.prices.G;
        dbUpdates.price_gg = updates.prices.GG;
      }

      const { error } = await supabase
        .from('pizza_flavors')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setFlavors(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      toast.success('Sabor atualizado');
    } catch (error) {
      console.error('Error updating flavor:', error);
      toast.error('Erro ao atualizar sabor');
    }
  };

  const deleteFlavor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pizza_flavors')
        .update({ available: false })
        .eq('id', id);

      if (error) throw error;

      setFlavors(prev => prev.filter(f => f.id !== id));
      toast.success('Sabor removido');
    } catch (error) {
      console.error('Error deleting flavor:', error);
      toast.error('Erro ao remover sabor');
    }
  };

  // Border CRUD
  const addBorder = async (border: Omit<PizzaBorder, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('pizza_borders')
        .insert({
          name: border.name,
          price: border.price,
        })
        .select()
        .single();

      if (error) throw error;

      setBorders(prev => [...prev, mapDbToBorder(data as DbBorder)]);
      toast.success('Borda adicionada');
      return data.id;
    } catch (error) {
      console.error('Error adding border:', error);
      toast.error('Erro ao adicionar borda');
      return null;
    }
  };

  const updateBorder = async (id: string, updates: Partial<PizzaBorder>) => {
    try {
      const { error } = await supabase
        .from('pizza_borders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setBorders(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      toast.success('Borda atualizada');
    } catch (error) {
      console.error('Error updating border:', error);
      toast.error('Erro ao atualizar borda');
    }
  };

  const deleteBorder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pizza_borders')
        .update({ available: false })
        .eq('id', id);

      if (error) throw error;

      setBorders(prev => prev.filter(b => b.id !== id));
      toast.success('Borda removida');
    } catch (error) {
      console.error('Error deleting border:', error);
      toast.error('Erro ao remover borda');
    }
  };

  // Product CRUD
  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          image_url: product.image,
          available: product.available,
        })
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => [...prev, mapDbToProduct(data as DbProduct)]);
      toast.success('Produto adicionado');
      return data.id;
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Erro ao adicionar produto');
      return null;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.category) dbUpdates.category = updates.category;
      if (updates.image !== undefined) dbUpdates.image_url = updates.image;
      if (updates.available !== undefined) dbUpdates.available = updates.available;

      const { error } = await supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      toast.success('Produto atualizado');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Erro ao atualizar produto');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ available: false })
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Produto removido');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Erro ao remover produto');
    }
  };

  // Image upload
  const uploadImage = async (file: File, folder: string = 'products'): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    }
  };

  return {
    flavors,
    borders,
    products,
    loading,
    addFlavor,
    updateFlavor,
    deleteFlavor,
    addBorder,
    updateBorder,
    deleteBorder,
    addProduct,
    updateProduct,
    deleteProduct,
    uploadImage,
    refetch: fetchAll,
  };
}