import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "update" | "delete";

type CreateBody = {
  action: "create";
  email: string;
  password: string;
  full_name?: string | null;
  role?: "staff" | "entregador";
};

type UpdateBody = {
  action: "update";
  user_id: string;
  email?: string;
  password?: string;
  full_name?: string | null;
};

type DeleteBody = {
  action: "delete";
  user_id: string;
};

type Body = CreateBody | UpdateBody | DeleteBody;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const badRequest = (message: string) => json({ error: message }, 400);
const unauthorized = (message: string) => json({ error: message }, 401);
const forbidden = (message: string) => json({ error: message }, 403);

const normalizeAuthAdminError = (err: any) => {
  const code = err?.code as string | undefined;
  const status = typeof err?.status === "number" ? err.status : 500;

  // Human-friendly message for common auth errors
  if (code === "weak_password") {
    return {
      status: 422,
      message: "Senha fraca (muito comum/comprometida). Use uma senha mais forte.",
      code,
    };
  }

  return {
    status,
    message: err?.message ?? "Erro ao atualizar usuário",
    code,
  };
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to the caller (to read auth user from JWT)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      console.warn("manage-staff-user: missing/invalid auth", userErr);
      return unauthorized("Não autenticado");
    }

    const callerId = userData.user.id;

    // Service role client for admin operations (create/update/delete users)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role server-side
    const { data: adminRoleRows, error: roleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .limit(1);

    if (roleErr) {
      console.error("manage-staff-user: role check error", roleErr);
      return json({ error: "Erro ao validar permissão" }, 500);
    }
    if (!adminRoleRows || adminRoleRows.length === 0) {
      return forbidden("Sem permissão");
    }

    const body = (await req.json()) as Partial<Body>;
    if (!body?.action) return badRequest("Ação inválida");

    if (body.action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const fullName = (body.full_name ?? null) as string | null;
      const role = (body.role ?? "staff") as "staff" | "entregador";

      if (role !== "staff" && role !== "entregador") return badRequest("Role inválido");

      if (!email || !isEmail(email)) return badRequest("Email inválido");
      if (!password || password.length < 6) return badRequest("Senha deve ter ao menos 6 caracteres");

      console.log("manage-staff-user:create", { email });

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        console.error("manage-staff-user:createUser error", createErr);
        const n = normalizeAuthAdminError(createErr);
        return json({ error: n.message, code: n.code }, n.status);
      }

      const userId = created.user.id;

      // Ensure profile exists
      const { error: profileErr } = await adminClient.from("profiles").insert({
        user_id: userId,
        email,
        full_name: fullName,
      });

      if (profileErr) {
        console.error("manage-staff-user:insert profile error", profileErr);
        // cleanup auth user if profile failed
        await adminClient.auth.admin.deleteUser(userId);
        return json({ error: "Erro ao criar perfil" }, 500);
      }

      // Add role (staff | entregador)
      const { error: roleInsertErr } = await adminClient.from("user_roles").insert({
        user_id: userId,
        role,
      });
      if (roleInsertErr) {
        console.error("manage-staff-user:insert role error", roleInsertErr);
        // cleanup
        await adminClient.from("profiles").delete().eq("user_id", userId);
        await adminClient.auth.admin.deleteUser(userId);
        return json({ error: "Erro ao atribuir permissão" }, 500);
      }

      return json({ success: true, user_id: userId });
    }

    if (body.action === "update") {
      const userId = String(body.user_id ?? "").trim();
      if (!userId) return badRequest("user_id obrigatório");

      const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
      const password = body.password !== undefined ? String(body.password) : undefined;
      const fullName = body.full_name !== undefined ? ((body.full_name ?? null) as string | null) : undefined;

      if (email !== undefined && (!email || !isEmail(email))) return badRequest("Email inválido");
      if (password !== undefined && password.length > 0 && password.length < 6)
        return badRequest("Senha deve ter ao menos 6 caracteres");

      console.log("manage-staff-user:update", { userId, hasEmail: !!email, hasPassword: !!password, hasName: fullName !== undefined });

      if (email !== undefined || (password !== undefined && password.length > 0)) {
        const { error: updErr } = await adminClient.auth.admin.updateUserById(userId, {
          ...(email !== undefined ? { email, email_confirm: true } : {}),
          ...(password !== undefined && password.length > 0 ? { password } : {}),
        });
        if (updErr) {
          console.error("manage-staff-user:update auth error", updErr);
          const n = normalizeAuthAdminError(updErr);
          return json({ error: n.message, code: n.code }, n.status);
        }
      }

      if (email !== undefined || fullName !== undefined) {
        const patch: Record<string, unknown> = {};
        if (email !== undefined) patch.email = email;
        if (fullName !== undefined) patch.full_name = fullName;

        const { error: profUpdErr } = await adminClient.from("profiles").update(patch).eq("user_id", userId);
        if (profUpdErr) {
          console.error("manage-staff-user:update profile error", profUpdErr);
          return json({ error: "Erro ao atualizar perfil" }, 500);
        }
      }

      return json({ success: true });
    }

    if (body.action === "delete") {
      const userId = String(body.user_id ?? "").trim();
      if (!userId) return badRequest("user_id obrigatório");
      if (userId === callerId) return badRequest("Você não pode excluir seu próprio usuário");

      console.log("manage-staff-user:delete", { userId });

      // Delete related rows first
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("user_id", userId);

      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) {
        console.error("manage-staff-user:deleteUser error", delErr);
        return json({ error: delErr.message }, 500);
      }

      return json({ success: true });
    }

    return badRequest("Ação inválida");
  } catch (error: unknown) {
    console.error("manage-staff-user:unhandled", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return json({ error: message }, 500);
  }
});
