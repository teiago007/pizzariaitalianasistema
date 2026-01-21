import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Shield, Trash2, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ProfileRow = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at?: string;
};

type UserRoleRow = {
  id?: string;
  user_id: string;
  role: "admin" | "user" | "staff";
};

type StaffForm = {
  user_id?: string;
  email: string;
  full_name: string;
  password: string;
};

const AdminStaff: React.FC = () => {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<StaffForm>({ email: "", full_name: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,user_id,email,full_name,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ProfileRow[]) || [];
    },
  });

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["admin-staff-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id,user_id,role");
      if (error) throw error;
      return (data as UserRoleRow[]) || [];
    },
  });

  const byUserId = useMemo(() => {
    const map = new Map<string, { isAdmin: boolean; isStaff: boolean }>();
    (roles || []).forEach((r) => {
      const prev = map.get(r.user_id) || { isAdmin: false, isStaff: false };
      if (r.role === "admin") prev.isAdmin = true;
      if (r.role === "staff") prev.isStaff = true;
      map.set(r.user_id, prev);
    });
    return map;
  }, [roles]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return profiles || [];
    return (profiles || []).filter((p) => {
      const email = (p.email || "").toLowerCase();
      const name = (p.full_name || "").toLowerCase();
      const uid = p.user_id.toLowerCase();
      return email.includes(query) || name.includes(query) || uid.includes(query);
    });
  }, [profiles, q]);

  const setStaff = async (userId: string, enabled: boolean) => {
    setSavingUserId(userId);
    try {
      if (enabled) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "staff" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "staff");
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
      toast.success("Permissão atualizada");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao atualizar permissão");
    } finally {
      setSavingUserId(null);
    }
  };

  const openCreate = () => {
    setDialogMode("create");
    setForm({ email: "", full_name: "", password: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: ProfileRow) => {
    setDialogMode("edit");
    setForm({ user_id: p.user_id, email: p.email || "", full_name: p.full_name || "", password: "" });
    setDialogOpen(true);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-staff-profiles"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
  };

  const submitForm = async () => {
    setSubmitting(true);
    try {
      const email = form.email.trim().toLowerCase();
      const full_name = form.full_name.trim();
      const password = form.password;

      if (!email || !email.includes("@")) throw new Error("Email inválido");

      if (dialogMode === "create") {
        if (!password || password.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");

        const { data, error } = await supabase.functions.invoke("manage-staff-user", {
          body: {
            action: "create",
            email,
            password,
            full_name: full_name || null,
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Funcionário criado");
      } else {
        if (!form.user_id) throw new Error("user_id ausente");

        const { data, error } = await supabase.functions.invoke("manage-staff-user", {
          body: {
            action: "update",
            user_id: form.user_id,
            email,
            full_name: full_name || null,
            ...(password ? { password } : {}),
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Funcionário atualizado");
      }

      setDialogOpen(false);
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar funcionário");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteStaffUser = async (userId: string) => {
    setSavingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-staff-user", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Funcionário removido");
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao remover funcionário");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Funcionários</h1>
        <p className="text-muted-foreground">Atribua/remova o acesso do garçom (role staff) com segurança.</p>
      </div>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gerenciar acessos
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por email, nome ou user_id"
                className="pl-9"
              />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" onClick={openCreate} className="sm:self-start">
                  <Plus className="w-4 h-4" />
                  Novo funcionário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{dialogMode === "create" ? "Criar funcionário" : "Editar funcionário"}</DialogTitle>
                  <DialogDescription>
                    {dialogMode === "create"
                      ? "Defina email, nome e senha para o funcionário entrar no caixa." 
                      : "Atualize email, nome e (opcionalmente) uma nova senha."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                      placeholder="Nome do funcionário"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{dialogMode === "create" ? "Senha" : "Nova senha (opcional)"}</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                      placeholder={dialogMode === "create" ? "mínimo 6 caracteres" : "deixe em branco para manter"}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={submitForm} disabled={submitting}>
                    {submitting ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingProfiles || loadingRoles ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            filtered.map((p) => {
              const flags = byUserId.get(p.user_id) || { isAdmin: false, isStaff: false };
              const disabled = flags.isAdmin;

              return (
                <div key={p.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <p className="font-semibold truncate">{p.full_name || p.email || "(sem nome)"}</p>
                      {flags.isAdmin ? (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="w-3 h-3" /> Admin
                        </Badge>
                      ) : null}
                      {flags.isStaff ? <Badge className="bg-secondary text-secondary-foreground">Staff</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{p.email || "(email não informado)"}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">user_id: {p.user_id}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">Acesso Staff</p>
                      <p className="text-xs text-muted-foreground">{disabled ? "Admin (fixo)" : "Garçom"}</p>
                    </div>
                    <Switch
                      checked={flags.isStaff}
                      disabled={disabled || savingUserId === p.user_id}
                      onCheckedChange={(checked) => setStaff(p.user_id, checked)}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={savingUserId === p.user_id}
                      onClick={() => openEdit(p)}
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          disabled={disabled || savingUserId === p.user_id}
                          title={disabled ? "Não é possível excluir um admin" : "Excluir"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso vai remover a conta e o acesso permanentemente. Essa ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteStaffUser(p.user_id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                refresh();
              }}
            >
              Atualizar lista
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStaff;
