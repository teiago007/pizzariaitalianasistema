import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Shield, Trash2, User, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

async function getEdgeFunctionErrorMessage(err: any, fallback: string) {
  const resp = err?.context;
  if (resp && typeof resp.json === "function") {
    try {
      const payload = await resp.json();
      const msg = payload?.error;
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // ignore
    }
  }
  return err?.message || fallback;
}

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
  role: "admin" | "user" | "staff" | "entregador";
};

type UserForm = {
  user_id?: string;
  email: string;
  full_name: string;
  password: string;
  role: "staff" | "entregador";
};

type RoleFilter = "all" | "staff" | "entregador" | "admin" | "none";

const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<UserForm>({ email: "", full_name: "", password: "", role: "staff" });

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-users-profiles"],
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
    queryKey: ["admin-users-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id,user_id,role");
      if (error) throw error;
      return (data as UserRoleRow[]) || [];
    },
  });

  const rolesByUserId = useMemo(() => {
    const map = new Map<string, Set<UserRoleRow["role"]>>();
    (roles || []).forEach((r) => {
      const set = map.get(r.user_id) || new Set<UserRoleRow["role"]>();
      set.add(r.role);
      map.set(r.user_id, set);
    });
    return map;
  }, [roles]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = profiles || [];
    const filteredByText = !query
      ? base
      : base.filter((p) => {
          const email = (p.email || "").toLowerCase();
          const name = (p.full_name || "").toLowerCase();
          const uid = p.user_id.toLowerCase();
          return email.includes(query) || name.includes(query) || uid.includes(query);
        });

    const filteredByRole = filteredByText.filter((p) => {
      const set = rolesByUserId.get(p.user_id) || new Set();
      if (roleFilter === "all") return true;
      if (roleFilter === "none") return set.size === 0;
      if (roleFilter === "admin") return set.has("admin");
      return set.has(roleFilter);
    });

    return filteredByRole;
  }, [profiles, q, roleFilter, rolesByUserId]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-users-profiles"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
  };

  const openCreate = () => {
    setDialogMode("create");
    setForm({ email: "", full_name: "", password: "", role: "staff" });
    setDialogOpen(true);
  };

  const openEdit = (p: ProfileRow) => {
    setDialogMode("edit");
    const set = rolesByUserId.get(p.user_id) || new Set();
    const initialRole: "staff" | "entregador" = set.has("entregador") ? "entregador" : "staff";
    setForm({ user_id: p.user_id, email: p.email || "", full_name: p.full_name || "", password: "", role: initialRole });
    setDialogOpen(true);
  };

  const submitForm = async () => {
    setSubmitting(true);
    try {
      const email = form.email.trim().toLowerCase();
      const full_name = form.full_name.trim();
      const password = form.password;
      const role = form.role;

      if (!email || !email.includes("@")) throw new Error("Email inválido");

      if (dialogMode === "create") {
        if (!password || password.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");

        const { data, error } = await supabase.functions.invoke("manage-staff-user", {
          body: { action: "create", email, password, full_name: full_name || null, role },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Usuário criado");
      } else {
        if (!form.user_id) throw new Error("user_id ausente");
        const { data, error } = await supabase.functions.invoke("manage-staff-user", {
          body: {
            action: "update",
            user_id: form.user_id,
            email,
            full_name: full_name || null,
            role,
            ...(password ? { password } : {}),
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Usuário atualizado");
      }

      setDialogOpen(false);
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(await getEdgeFunctionErrorMessage(e, "Erro ao salvar usuário"));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setSavingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-staff-user", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Usuário removido");
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(await getEdgeFunctionErrorMessage(e, "Erro ao remover usuário"));
    } finally {
      setSavingUserId(null);
    }
  };

  const getBadges = (userId: string) => {
    const set = rolesByUserId.get(userId) || new Set();
    const badges: React.ReactNode[] = [];

    if (set.has("admin")) {
      badges.push(
        <Badge key="admin" variant="outline" className="gap-1">
          <Shield className="w-3 h-3" /> Admin
        </Badge>,
      );
    }
    if (set.has("staff")) badges.push(<Badge key="staff" className="bg-secondary text-secondary-foreground">Staff</Badge>);
    if (set.has("entregador")) badges.push(<Badge key="entregador" className="bg-secondary text-secondary-foreground">Entregador</Badge>);
    return badges;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground">Gerencie Funcionários e Entregadores em uma única tela.</p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Lista
          </CardTitle>

          <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email, nome ou user_id" className="pl-9" />
              </div>

              <div className="w-full sm:w-56">
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter((v as RoleFilter) || "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="entregador">Entregador</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="none">Sem papel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" onClick={openCreate} className="lg:self-start">
                  <Plus className="w-4 h-4" />
                  Novo usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{dialogMode === "create" ? "Criar usuário" : "Editar usuário"}</DialogTitle>
                  <DialogDescription>
                    {dialogMode === "create" ? "Crie um Staff ou Entregador." : "Edite dados e troque o tipo (Staff/Entregador)."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de usuário</Label>
                    <Select value={form.role} onValueChange={(v) => setForm((s) => ({ ...s, role: v === "entregador" ? "entregador" : "staff" }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Funcionário (Staff)</SelectItem>
                        <SelectItem value="entregador">Entregador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="email@exemplo.com" autoComplete="off" />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} placeholder="Nome" />
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
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            list.map((p) => {
              const roleSet = rolesByUserId.get(p.user_id) || new Set();
              const isAdmin = roleSet.has("admin");

              return (
                <div key={p.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <p className="font-semibold truncate">{p.full_name || p.email || "(sem nome)"}</p>
                      {getBadges(p.user_id)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{p.email || "(email não informado)"}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">user_id: {p.user_id}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" disabled={savingUserId === p.user_id} onClick={() => openEdit(p)}>
                      Editar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="icon" disabled={isAdmin || savingUserId === p.user_id} title={isAdmin ? "Não é possível excluir um admin" : "Excluir"}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                          <AlertDialogDescription>Isso vai remover a conta e o acesso permanentemente. Essa ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteUser(p.user_id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-2">
            <Button type="button" variant="outline" onClick={refresh}>
              Atualizar lista
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
