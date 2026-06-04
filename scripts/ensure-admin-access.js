const fs = require("node:fs");
const path = require("node:path");
const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(envPath = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  realtime: { transport: WebSocket },
});

const admins = [
  { email: "i9smarterp1@i9smart.local", password: "123456", role: "suporte" },
  { email: "gestor1@i9smart.local", password: "123456", role: "gestor" },
];

async function ensureAdmin({ email, password, role }) {
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

  const upserted = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email,
        role,
        ativo: true,
        removido_em: null,
        removido_por: null,
        motivo_remocao: null,
      },
      { onConflict: "email" },
    )
    .select("id,email,role,ativo")
    .single();

  if (upserted.error) throw upserted.error;
  return upserted.data;
}

async function main() {
  const users = [];
  for (const admin of admins) users.push(await ensureAdmin(admin));
  console.log(JSON.stringify({ ok: true, users }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
