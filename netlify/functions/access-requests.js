const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not configured");
  return createClient(url, key, { realtime: { transport: WebSocket } });
}

function bearer(event) {
  const raw = event.headers.authorization || event.headers.Authorization || "";
  return raw.startsWith("Bearer ") ? raw.slice(7) : "";
}

function normalizeEmail(emailOrUser) {
  const value = String(emailOrUser || "").trim().toLowerCase();
  if (!value) return "";
  return value.includes("@") ? value : `${value}@i9smart.local`;
}

async function currentUserRole(supabase, token) {
  const auth = await supabase.auth.getUser(token);
  if (auth.error || !auth.data.user?.email) return null;
  const email = auth.data.user.email.toLowerCase();
  const { data, error } = await supabase
    .from("users")
    .select("id,email,role,ativo")
    .eq("email", email)
    .eq("ativo", true)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function ensureRequesterCanApprove(supabase, token, approvedRole) {
  const requester = await currentUserRole(supabase, token);
  if (!requester) throw new Error("Sessao sem permissao");
  if (requester.role === "suporte") return requester;
  if (requester.role === "gestor" && approvedRole !== "suporte" && approvedRole !== "gestor") {
    return requester;
  }
  throw new Error("Perfil sem permissao para aprovar este acesso");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON invalido" });
  }

  try {
    const supabase = client();

    if (body.action === "password-login") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const auth = await supabase.auth.signInWithPassword({ email, password });
      if (auth.error || !auth.data.session?.access_token) {
        return json(401, { error: "Credenciais invalidas" });
      }
      const { data: user } = await supabase
        .from("users")
        .select("id,email,role,ativo")
        .eq("email", email)
        .eq("ativo", true)
        .maybeSingle();
      if (!user || user.role !== "suporte") {
        return json(403, { error: "Conta sem acesso de suporte" });
      }
      return json(200, {
        session: auth.data.session,
        user,
      });
    }

    if (body.action === "signup") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const requestedRole = String(body.requested_role || "responsavel");
      if (!email || !password || password.length < 6) {
        return json(400, { error: "Informe e-mail e senha com pelo menos 6 caracteres" });
      }

      const existingUser = await supabase
        .from("users")
        .select("id,email,role,ativo")
        .eq("email", email)
        .eq("ativo", true)
        .maybeSingle();
      if (existingUser.data) return json(200, { status: "approved", user: existingUser.data });

      const list = await supabase.auth.admin.listUsers();
      if (list.error) throw list.error;
      let authUser = list.data.users.find((user) => String(user.email).toLowerCase() === email);
      if (authUser) {
        const updated = await supabase.auth.admin.updateUserById(authUser.id, {
          email,
          password,
          email_confirm: true,
        });
        if (updated.error) throw updated.error;
        authUser = updated.data.user;
      } else {
        const created = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (created.error) throw created.error;
        authUser = created.data.user;
      }

      const upsert = await supabase.from("access_requests").upsert(
        {
          auth_user_id: authUser.id,
          email,
          name: body.name || email,
          requested_role: requestedRole,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
      if (upsert.error) throw upsert.error;
      return json(200, { status: "pending", email, requested_role: requestedRole });
    }

    if (body.action === "request") {
      const token = bearer(event) || body.access_token;
      if (!token) return json(401, { error: "Token ausente" });
      const auth = await supabase.auth.getUser(token);
      if (auth.error || !auth.data.user?.email) return json(401, { error: "Token invalido" });

      const authUser = auth.data.user;
      const email = authUser.email.toLowerCase();
      const existing = await supabase
        .from("users")
        .select("id,email,role,ativo")
        .eq("email", email)
        .eq("ativo", true)
        .maybeSingle();
      if (existing.data) return json(200, { status: "approved", user: existing.data });

      const requestedRole = String(body.requested_role || "responsavel");
      const metadata = authUser.user_metadata || {};
      const upsert = await supabase.from("access_requests").upsert(
        {
          auth_user_id: authUser.id,
          email,
          name: metadata.full_name || metadata.name || email,
          avatar_url: metadata.avatar_url || metadata.picture || null,
          requested_role: requestedRole,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
      if (upsert.error) throw upsert.error;
      return json(200, { status: "pending", email, requested_role: requestedRole });
    }

    if (body.action === "list") {
      const requester = await currentUserRole(supabase, bearer(event));
      if (!requester || !["suporte", "gestor"].includes(requester.role)) {
        return json(403, { error: "Sem permissao" });
      }
      let query = supabase
        .from("access_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (requester.role === "gestor") query = query.neq("requested_role", "suporte").neq("requested_role", "gestor");
      const { data, error } = await query;
      if (error) throw error;
      return json(200, { data });
    }

    if (body.action === "approve") {
      const id = body.id;
      const approvedRole = String(body.role || body.approved_role || "");
      if (!id || !approvedRole) return json(400, { error: "id e role sao obrigatorios" });
      const requester = await ensureRequesterCanApprove(supabase, bearer(event), approvedRole);

      const request = await supabase.from("access_requests").select("*").eq("id", id).maybeSingle();
      if (request.error || !request.data) return json(404, { error: "Solicitacao nao encontrada" });

      const authUserId = request.data.auth_user_id;
      const email = request.data.email;
      const userUpsert = await supabase.from("users").upsert(
        { id: authUserId, email, role: approvedRole, ativo: true, removido_em: null, motivo_remocao: null },
        { onConflict: "email" }
      );
      if (userUpsert.error) throw userUpsert.error;

      const update = await supabase
        .from("access_requests")
        .update({
          status: "approved",
          approved_role: approvedRole,
          approved_by: requester.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (update.error) throw update.error;
      return json(200, { ok: true, email, role: approvedRole });
    }

    return json(400, { error: "Acao invalida" });
  } catch (error) {
    return json(500, { error: error.message || "Erro interno" });
  }
};
