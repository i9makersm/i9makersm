/**
 * ERP Educacional — API Backend Completo e Definitivo
 * Fastify + TypeScript + Prisma + Supabase Auth
 * Arquivo único — todos os módulos
 */

import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const app     = Fastify({ logger: true });
const prisma  = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ─── RBAC ────────────────────────────────────────────────────────────────────
const HIERARQUIA: Record<string, string[]> = {
  suporte:     ["gestor"],
  gestor:      ["professor","responsavel","aluno"],
  professor:   [], responsavel: [], aluno: [], colaborador: [],
};

async function auth(req: any, reply: any) {
  const token = req.headers.authorization?.replace("Bearer ","");
  if (!token) return reply.status(401).send({ error:"Token ausente" });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return reply.status(401).send({ error:"Token inválido" });
  const user = await prisma.users.findUnique({ where:{ id:data.user.id } });
  if (!user || !user.ativo) return reply.status(403).send({ error:"Acesso negado" });
  req.user = user;
}

function requireRole(...roles: string[]) {
  return async (req: any, reply: any) => {
    if (!roles.includes(req.user?.role))
      return reply.status(403).send({ error:`Perfil ${req.user?.role} não tem acesso` });
  };
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post("/auth/login", async (req:any, reply) => {
  const { email, password } = z.object({ email:z.string().email(), password:z.string().min(6) }).parse(req.body);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return reply.status(401).send({ error:"Credenciais inválidas" });
  const user = await prisma.users.findUnique({ where:{ id:data.user!.id } });
  return { access_token:data.session!.access_token, refresh_token:data.session!.refresh_token,
           user:{ id:user!.id, email:user!.email, role:user!.role } };
});

app.post("/auth/refresh", async (req:any, reply) => {
  const { refresh_token } = req.body as any;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) return reply.status(401).send({ error:"Token inválido" });
  return { access_token: data.session!.access_token };
});

app.post("/auth/logout", { preHandler:[auth] }, async () => {
  await supabase.auth.signOut(); return { ok:true };
});

// ─── CONVITES ────────────────────────────────────────────────────────────────
const PORTAL_URLS: Record<string,string> = {
  gestor:      process.env.PORTAL_GESTOR_URL    ?? "http://localhost:3001",
  professor:   process.env.PORTAL_GESTOR_URL    ?? "http://localhost:3001",
  colaborador: process.env.PORTAL_COLAB_URL     ?? "http://localhost:3002",
  responsavel: process.env.PORTAL_RESP_URL      ?? "http://localhost:3003",
  aluno:       process.env.PORTAL_RESP_URL      ?? "http://localhost:3003",
  suporte:     process.env.PORTAL_SUPORTE_URL   ?? "http://localhost:3004",
};

app.post("/convites", { preHandler:[auth] }, async (req:any, reply) => {
  const body = z.object({
    role_destino: z.enum(["gestor","professor","responsavel","aluno"]),
    email_destino: z.string().email().optional(),
    nome_destino:  z.string().optional(),
    empresa_id:    z.string().uuid().optional(),
    metadata:      z.object({ turma_id:z.string().uuid().optional(), aluno_id:z.string().uuid().optional() }).optional(),
  }).parse(req.body);

  const roles = HIERARQUIA[req.user.role] ?? [];
  if (!roles.includes(body.role_destino))
    return reply.status(403).send({ error:`${req.user.role} não pode convidar ${body.role_destino}` });

  let empresa_id = body.empresa_id;
  if (!empresa_id) {
    const g = await prisma.gestores.findFirst({ where:{ user_id:req.user.id } });
    empresa_id = g?.empresa_id;
  }
  if (!empresa_id) return reply.status(422).send({ error:"empresa_id obrigatório" });

  const convite = await prisma.convites.create({
    data: { empresa_id, criado_por:req.user.id, role_destino:body.role_destino as any,
            email_destino:body.email_destino, nome_destino:body.nome_destino,
            metadata:body.metadata ?? {}, expira_em:new Date(Date.now()+7*86400000) },
  });
  const link = `${PORTAL_URLS[body.role_destino]}/entrar?token=${convite.token}`;
  return reply.status(201).send({ token:convite.token, link, expira_em:convite.expira_em });
});

app.get("/convites/:token", async (req:any, reply) => {
  const convite = await prisma.convites.findUnique({
    where:{ token:req.params.token }, include:{ empresas:{ select:{ nome:true,logo_url:true } } }
  });
  if (!convite) return reply.status(404).send({ error:"Convite não encontrado" });
  if (convite.usado) return reply.status(410).send({ error:"Convite já utilizado" });
  if (convite.expira_em < new Date()) return reply.status(410).send({ error:"Convite expirado" });
  return { valido:true, role:convite.role_destino, email:convite.email_destino,
           nome:convite.nome_destino, empresa:convite.empresas.nome };
});

app.post("/convites/:token/aceitar", async (req:any, reply) => {
  const { nome, password } = z.object({ nome:z.string().min(2), password:z.string().min(8) }).parse(req.body);
  const convite = await prisma.convites.findUnique({ where:{ token:req.params.token } });
  if (!convite || convite.usado || convite.expira_em < new Date())
    return reply.status(410).send({ error:"Convite inválido ou expirado" });

  const email = convite.email_destino ?? (req.body as any).email;
  if (!email) return reply.status(422).send({ error:"Email obrigatório" });

  const resultado = await prisma.$transaction(async (tx) => {
    const { data:authData } = await supabase.auth.admin.createUser({ email, password, email_confirm:true });
    const newUser = await tx.users.create({ data:{ id:authData.user!.id, email, role:convite.role_destino as any } });
    const meta = convite.metadata as any;

    if (convite.role_destino==="gestor")
      await tx.gestores.create({ data:{ user_id:newUser.id, empresa_id:convite.empresa_id, nome } });
    else if (convite.role_destino==="professor") {
      const col = await tx.colaboradores.create({ data:{ user_id:newUser.id, empresa_id:convite.empresa_id, nome, cargo:"Professor", regime:"clt" } });
      if (meta?.turma_id) await tx.professor_turmas.create({ data:{ professor_id:col.id, turma_id:meta.turma_id, concedido_por:convite.criado_por } });
    } else if (convite.role_destino==="responsavel") {
      const resp = await tx.responsaveis.create({ data:{ user_id:newUser.id, nome } });
      if (meta?.aluno_id) await tx.alunos.updateMany({ where:{ id:meta.aluno_id, responsavel_id:null }, data:{ responsavel_id:resp.id } });
    } else if (convite.role_destino==="aluno" && meta?.aluno_id)
      await tx.alunos.update({ where:{ id:meta.aluno_id }, data:{ user_id:newUser.id } });

    await tx.convites.update({ where:{ token:req.params.token }, data:{ usado:true, user_criado:newUser.id } });
    return newUser;
  });

  const { data:session } = await supabase.auth.signInWithPassword({ email, password });
  return reply.status(201).send({
    access_token:session?.session?.access_token,
    refresh_token:session?.session?.refresh_token,
    user:{ id:resultado.id, email:resultado.email, role:resultado.role },
    redirect_to:PORTAL_URLS[convite.role_destino],
  });
});

app.get("/convites", { preHandler:[auth] }, async (req:any, reply) => {
  const g = await prisma.gestores.findFirst({ where:{ user_id:req.user.id } });
  const empresa_id = g?.empresa_id ?? (req.query as any).empresa_id;
  const convites = await prisma.convites.findMany({
    where:{ empresa_id }, orderBy:{ criado_em:"desc" }, take:50,
    select:{ token:true,role_destino:true,email_destino:true,nome_destino:true,usado:true,expira_em:true,criado_em:true }
  });
  return { data:convites.map(c=>({ ...c, status:c.usado?"usado":c.expira_em<new Date()?"expirado":"pendente" })) };
});

// ─── PONTO (imutável, timestamp server-side) ─────────────────────────────────
app.post("/ponto/registrar", { preHandler:[auth, requireRole("colaborador","professor")] }, async (req:any, reply) => {
  const body = z.object({
    tipo:z.enum(["entrada","inicio_intervalo","fim_intervalo","saida"]),
    latitude:z.number().optional(), longitude:z.number().optional(),
  }).parse(req.body);

  const colab = await prisma.colaboradores.findFirst({ where:{ user_id:req.user.id, ativo:true } });
  if (!colab) return reply.status(404).send({ error:"Colaborador não encontrado" });

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hoje_registros = await prisma.registros_ponto.findMany({
    where:{ colaborador_id:colab.id, registrado_em:{ gte:hoje } }, orderBy:{ registrado_em:"asc" }
  });

  const deps:Record<string,string[]> = {
    entrada:[], inicio_intervalo:["entrada"],
    fim_intervalo:["entrada","inicio_intervalo"], saida:["entrada","inicio_intervalo","fim_intervalo"],
  };
  const registrados = hoje_registros.map(r=>r.tipo);
  const faltando = deps[body.tipo].filter(d=>!registrados.includes(d as any));
  if (faltando.length) return reply.status(422).send({ error:`Registre antes: ${faltando.join(", ")}` });
  if (registrados.includes(body.tipo as any)) return reply.status(422).send({ error:"Já registrado hoje" });

  const reg = await prisma.registros_ponto.create({
    data:{ colaborador_id:colab.id, tipo:body.tipo, registrado_em:new Date(),
           latitude:body.latitude, longitude:body.longitude, ip_origem:req.ip }
  });
  return reply.status(201).send({ id:reg.id, registrado_em:reg.registrado_em });
});

app.get("/ponto/hoje", { preHandler:[auth] }, async (req:any, reply) => {
  const colab = await prisma.colaboradores.findFirst({ where:{ user_id:req.user.id } });
  if (!colab) return reply.status(404).send({ error:"Colaborador não encontrado" });
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const regs = await prisma.registros_ponto.findMany({
    where:{ colaborador_id:colab.id, registrado_em:{ gte:hoje } }, orderBy:{ registrado_em:"asc" }
  });
  return {
    entrada:          regs.find(r=>r.tipo==="entrada")?.registrado_em ?? null,
    inicio_intervalo: regs.find(r=>r.tipo==="inicio_intervalo")?.registrado_em ?? null,
    fim_intervalo:    regs.find(r=>r.tipo==="fim_intervalo")?.registrado_em ?? null,
    saida:            regs.find(r=>r.tipo==="saida")?.registrado_em ?? null,
    banco_horas_min:  colab.banco_horas_min,
  };
});

app.get("/ponto/historico", { preHandler:[auth] }, async (req:any, reply) => {
  const colab = await prisma.colaboradores.findFirst({ where:{ user_id:req.user.id } });
  if (!colab) return reply.status(404).send({ error:"Não encontrado" });
  const { page=1, pageSize=20 } = req.query as any;
  const regs = await prisma.registros_ponto.findMany({
    where:{ colaborador_id:colab.id }, orderBy:{ registrado_em:"desc" },
    skip:(page-1)*pageSize, take:pageSize
  });
  return { data:regs, banco_horas_min:colab.banco_horas_min };
});

// ─── TURMAS ──────────────────────────────────────────────────────────────────
app.get("/turmas", { preHandler:[auth] }, async (req:any, reply) => {
  let empresa_id: string | null = null;
  if (["gestor","suporte"].includes(req.user.role)) {
    const g = await prisma.gestores.findFirst({ where:{ user_id:req.user.id } });
    empresa_id = g?.empresa_id ?? (req.query as any).empresa_id;
  } else if (req.user.role==="professor") {
    const colab = await prisma.colaboradores.findFirst({ where:{ user_id:req.user.id } });
    if (!colab) return reply.status(404).send({ error:"Não encontrado" });
    const pts = await prisma.professor_turmas.findMany({
      where:{ professor_id:colab.id }, include:{ turmas:{ include:{ _count:{ select:{ matriculas:{ where:{ status:"ativa" } } } } } } }
    });
    return { data:pts.map(p=>({ ...p.turmas, total_alunos:p.turmas._count.matriculas })) };
  }
  if (!empresa_id) return reply.status(422).send({ error:"empresa_id obrigatório" });
  const turmas = await prisma.turmas.findMany({
    where:{ empresa_id, ativa:true },
    include:{ _count:{ select:{ matriculas:{ where:{ status:"ativa" } } } }, colaboradores:{ select:{ nome:true } } }
  });
  return { data:turmas };
});

// ─── CHAMADA (timestamp automático) ──────────────────────────────────────────
app.post("/turmas/:id/chamada", { preHandler:[auth] }, async (req:any, reply) => {
  const { id:turma_id } = req.params as any;
  const body = z.object({
    topico:    z.string().optional(),
    registros: z.array(z.object({ aluno_id:z.string().uuid(), presente:z.boolean() })).min(1),
  }).parse(req.body);

  // Data e hora automáticas — professor não informa
  const hoje = new Date();
  const dataAula = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  let aula = await prisma.aulas.findUnique({ where:{ turma_id_data:{ turma_id, data:dataAula } } });
  if (!aula) aula = await prisma.aulas.create({ data:{ turma_id, data:dataAula, topico:body.topico } });

  const colab = await prisma.colaboradores.findFirst({ where:{ user_id:req.user.id } });
  const ops = body.registros.map(r =>
    prisma.registros_frequencia.upsert({
      where:{ aula_id_aluno_id:{ aula_id:aula!.id, aluno_id:r.aluno_id } },
      create:{ aula_id:aula!.id, aluno_id:r.aluno_id, presente:r.presente, registrado_por:colab?.id },
      update:{ presente:r.presente, registrado_por:colab?.id, registrado_em:new Date() },
    })
  );
  await prisma.$transaction(ops);

  const presentes = body.registros.filter(r=>r.presente).length;
  return reply.status(201).send({
    aula_id:aula.id, data:dataAula.toISOString().split("T")[0],
    presentes, faltas:body.registros.length-presentes,
    total:body.registros.length, registrado_em:new Date().toISOString(),
  });
});

// ─── ALUNOS ──────────────────────────────────────────────────────────────────
app.get("/turmas/:id/alunos", { preHandler:[auth] }, async (req:any, reply) => {
  const { id:turma_id } = req.params as any;
  const mats = await prisma.matriculas.findMany({
    where:{ turma_id, status:"ativa" },
    include:{ alunos:{ select:{ id:true,nome:true,data_nascimento:true,foto_url:true } } }
  });
  const lista = await Promise.all(mats.map(async m => {
    const [total, pres] = await Promise.all([
      prisma.aulas.count({ where:{ turma_id, cancelada:false } }),
      prisma.registros_frequencia.count({ where:{ aluno_id:m.aluno_id, presente:true, aulas:{ turma_id } } })
    ]);
    return { ...m.alunos, frequencia:{ presencas:pres, total, percentual:total>0?Math.round(pres/total*100):0 } };
  }));
  return { data:lista };
});

app.post("/alunos", { preHandler:[auth, requireRole("gestor","suporte")] }, async (req:any, reply) => {
  const body = z.object({
    nome:z.string().min(2), data_nascimento:z.string().optional(),
    responsavel:z.object({ nome:z.string(), email:z.string().email(), telefone:z.string().optional() }),
    turma_id:z.string().uuid().optional(), dia_vencimento:z.number().int().min(1).max(28).optional(),
  }).parse(req.body);

  const g = await prisma.gestores.findFirst({ where:{ user_id:req.user.id } });
  const resultado = await prisma.$transaction(async tx => {
    let userResp = await tx.users.findFirst({ where:{ email:body.responsavel.email } });
    if (!userResp) {
      const { data } = await supabase.auth.admin.createUser({ email:body.responsavel.email, password:Math.random().toString(36).slice(-10), email_confirm:true });
      userResp = await tx.users.create({ data:{ id:data.user!.id, email:body.responsavel.email, role:"responsavel" } });
    }
    let resp = await tx.responsaveis.findFirst({ where:{ user_id:userResp.id } });
    if (!resp) resp = await tx.responsaveis.create({ data:{ user_id:userResp.id, nome:body.responsavel.nome, telefone:body.responsavel.telefone } });
    const aluno = await tx.alunos.create({ data:{ responsavel_id:resp.id, nome:body.nome, data_nascimento:body.data_nascimento?new Date(body.data_nascimento):undefined } });
    let matricula = null;
    if (body.turma_id) matricula = await tx.matriculas.create({ data:{ aluno_id:aluno.id, turma_id:body.turma_id, dia_vencimento:body.dia_vencimento??10 } });
    return { aluno, responsavel:resp, matricula };
  });
  return reply.status(201).send({ data:resultado });
});

// ─── FREQUÊNCIA (portal responsável / aluno) ──────────────────────────────────
app.get("/alunos/:id/frequencia", { preHandler:[auth] }, async (req:any, reply) => {
  const { id } = req.params as any;
  const regs = await prisma.registros_frequencia.findMany({
    where:{ aluno_id:id }, orderBy:{ registrado_em:"desc" },
    include:{ aulas:{ select:{ data:true, topico:true, turma_id:true } } }
  });
  const pres = regs.filter(r=>r.presente).length;
  return { data:regs, resumo:{ presencas:pres, faltas:regs.length-pres, total:regs.length, percentual:regs.length>0?Math.round(pres/regs.length*100):0 } };
});

// ─── COBRANÇAS ────────────────────────────────────────────────────────────────
app.get("/cobrancas/minhas", { preHandler:[auth, requireRole("responsavel")] }, async (req:any, reply) => {
  const resp = await prisma.responsaveis.findFirst({ where:{ user_id:req.user.id } });
  if (!resp) return reply.status(404).send({ error:"Não encontrado" });
  const cobs = await prisma.cobrancas.findMany({
    where:{ matriculas:{ alunos:{ responsavel_id:resp.id } } },
    include:{ matriculas:{ include:{ alunos:{ select:{ nome:true } }, turmas:{ select:{ nome:true } } } } },
    orderBy:{ vencimento:"asc" }
  });
  return { data:cobs };
});

app.get("/cobrancas/:id/pix", { preHandler:[auth] }, async (req:any, reply) => {
  const cob = await prisma.cobrancas.findUnique({ where:{ id:req.params.id } });
  if (!cob) return reply.status(404).send({ error:"Não encontrado" });
  if (cob.status==="pago") return reply.status(422).send({ error:"Já pago" });
  const pix = cob.pix_copia_cola ?? `00020126580014br.gov.bcb.pix0136${cob.id}5204000053039865406${cob.valor}5802BR6304ABCD`;
  if (!cob.pix_copia_cola) await prisma.cobrancas.update({ where:{ id:req.params.id }, data:{ pix_copia_cola:pix } });
  return { pix_copia_cola:pix, qrcode_url:`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pix)}` };
});

app.post("/cobrancas/gerar", { preHandler:[auth, requireRole("gestor","suporte")] }, async (req:any, reply) => {
  const { mes, ano } = z.object({ mes:z.number().min(1).max(12), ano:z.number() }).parse(req.body);
  const g = await prisma.gestores.findFirst({ where:{ user_id:req.user.id } });
  const mats = await prisma.matriculas.findMany({ where:{ status:"ativa", turmas:{ empresa_id:g!.empresa_id } }, include:{ turmas:{ select:{ mensalidade:true } } } });
  let criadas=0, ignoradas=0;
  for (const m of mats) {
    try {
      await prisma.cobrancas.create({ data:{ matricula_id:m.id, referencia_mes:mes, referencia_ano:ano,
        valor:m.turmas.mensalidade, desconto:0, vencimento:new Date(ano,mes-1,m.dia_vencimento), status:"pendente" } });
      criadas++;
    } catch { ignoradas++; }
  }
  return reply.status(201).send({ criadas, ignoradas, total:mats.length });
});

app.get("/financeiro/dashboard", { preHandler:[auth, requireRole("gestor","suporte")] }, async (req:any, reply) => {
  const g = await prisma.gestores.findFirst({ where:{ user_id:req.user.id } });
  const { mes, ano } = req.query as any;
  const mesN=mes?Number(mes):new Date().getMonth()+1, anoN=ano?Number(ano):new Date().getFullYear();
  const cobs = await prisma.cobrancas.findMany({
    where:{ referencia_mes:mesN, referencia_ano:anoN, matriculas:{ turmas:{ empresa_id:g!.empresa_id } } }
  });
  const total=cobs.reduce((s,c)=>s+Number(c.valor),0);
  const recebido=cobs.filter(c=>c.status==="pago").reduce((s,c)=>s+Number(c.pago_valor??c.valor),0);
  return { mes:`${mesN}/${anoN}`, faturamento:total, recebido, inadimplencia:total-recebido,
           taxa_recebimento:total>0?Math.round(recebido/total*100):0 };
});

// ─── HOLERITES ───────────────────────────────────────────────────────────────
app.get("/holerites", { preHandler:[auth, requireRole("colaborador","professor")] }, async (req:any, reply) => {
  const colab = await prisma.colaboradores.findFirst({ where:{ user_id:req.user.id } });
  if (!colab) return reply.status(404).send({ error:"Não encontrado" });
  const hols = await prisma.holerites.findMany({ where:{ colaborador_id:colab.id }, orderBy:[{ ano:"desc" },{ mes:"desc" }] });
  return { data:hols };
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", async () => ({ status:"ok", ts:new Date().toISOString(), version:"1.0.0" }));

// ─── START ────────────────────────────────────────────────────────────────────
app.listen({ port:Number(process.env.PORT??3000), host:"0.0.0.0" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
});
