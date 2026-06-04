const fs = require("node:fs");
const path = require("node:path");
const WebSocket = require("ws");
const { PrismaClient } = require("@prisma/client");
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

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: WebSocket },
});

async function ensureAuthUser(email, password) {
  const list = await supabase.auth.admin.listUsers();
  if (list.error) throw list.error;
  const existing = list.data.users.find((user) => String(user.email).toLowerCase() === email);
  if (existing) {
    const updated = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
    });
    if (updated.error) throw updated.error;
    return updated.data.user;
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  return created.data.user;
}

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.access_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      auth_user_id uuid NOT NULL,
      email text NOT NULL UNIQUE,
      name text,
      avatar_url text,
      requested_role public."RoleUsuario" NOT NULL DEFAULT 'responsavel',
      status text NOT NULL DEFAULT 'pending',
      approved_role public."RoleUsuario",
      approved_by uuid REFERENCES public.users(id),
      approved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS access_requests_status_idx ON public.access_requests(status)
  `);

  const email = "i9smarterp1@i9smart.local";
  const password = "123456";
  const authUser = await ensureAuthUser(email, password);

  await prisma.users.upsert({
    where: { email },
    update: {
      id: authUser.id,
      role: "suporte",
      ativo: true,
      removido_em: null,
      removido_por: null,
      motivo_remocao: null,
    },
    create: {
      id: authUser.id,
      email,
      role: "suporte",
      ativo: true,
    },
  });

  console.log(JSON.stringify({ ok: true, support: { email, password, role: "suporte", id: authUser.id } }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
