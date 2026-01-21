import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Shield, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

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

const AdminStaff: React.FC = () => {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por email, nome ou user_id"
              className="pl-9"
            />
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
                queryClient.invalidateQueries({ queryKey: ["admin-staff-profiles"] });
                queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
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
