const fs = require("node:fs");
const path = require("node:path");
const WebSocket = require("ws");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(envPath = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} nao configurada no .env`);
  }
}

process.env.DATABASE_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: WebSocket },
});

const IDS = {
  company: "22222222-2222-2222-2222-222222222222",
  gestor: "11111111-1111-1111-1111-111111111111",
  professor: "22222222-2222-2222-2222-222222222223",
  responsavel: "33333333-3333-3333-3333-333333333334",
  aluno: "44444444-4444-4444-4444-444444444445",
  suporte: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  colaborador: "88888888-8888-8888-8888-888888888881",
  turma: "55555555-5555-5555-5555-555555555551",
  aula: "66666666-6666-6666-6666-666666666661",
  matricula: "77777777-7777-7777-7777-777777777771",
  responsavelProfile: "99999999-9999-9999-9999-999999999991",
};

const EMAILS = {
  gestor: "gestor@arteemmovimento.com",
  professor: "anapaula@arteemmovimento.com",
  responsavel: "carla@email.com",
  aluno: "sofia@email.com",
  suporte: "suporte@erp.com",
};

const PASSWORDS = {
  gestor: "Gestor@2026",
  professor: "Prof@2026",
  responsavel: "Resp@2026",
  aluno: "Aluno@2026",
  suporte: "Suporte@2026",
};

async function ensureAuthUser(id, email, password) {
  const { data } = await supabase.auth.admin.getUserById(id);
  if (!data?.user) {
    const created = await supabase.auth.admin.createUser({
      id,
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    return;
  }

  const updated = await supabase.auth.admin.updateUserById(id, {
    email,
    password,
    email_confirm: true,
  });
  if (updated.error) throw updated.error;
}

async function upsertById(model, id, data, createData) {
  const existing = await model.findUnique({ where: { id } });
  if (existing) return model.update({ where: { id }, data });
  return model.create({ data: { id, ...createData } });
}

async function main() {
  await prisma.empresas.upsert({
    where: { id: IDS.company },
    update: {
      nome: "Studio Arte em Movimento",
      cnpj: "11.222.333/0001-44",
      segmento: "Escola de Dança",
      email: "contato@arteemmovimento.com",
      plano: "growth",
      ativo: true,
    },
    create: {
      id: IDS.company,
      nome: "Studio Arte em Movimento",
      cnpj: "11.222.333/0001-44",
      segmento: "Escola de Dança",
      email: "contato@arteemmovimento.com",
      plano: "growth",
    },
  });

  await prisma.users.upsert({
    where: { email: EMAILS.gestor },
    update: { id: IDS.gestor, role: "gestor", ativo: true, removido_em: null, removido_por: null, motivo_remocao: null },
    create: { id: IDS.gestor, email: EMAILS.gestor, role: "gestor" },
  });

  await prisma.users.upsert({
    where: { email: EMAILS.professor },
    update: { id: IDS.professor, role: "professor_colab", ativo: true, removido_em: null, removido_por: null, motivo_remocao: null },
    create: { id: IDS.professor, email: EMAILS.professor, role: "professor_colab" },
  });

  await prisma.users.upsert({
    where: { email: EMAILS.responsavel },
    update: { id: IDS.responsavel, role: "responsavel", ativo: true, removido_em: null, removido_por: null, motivo_remocao: null },
    create: { id: IDS.responsavel, email: EMAILS.responsavel, role: "responsavel" },
  });

  await prisma.users.upsert({
    where: { email: EMAILS.aluno },
    update: { id: IDS.aluno, role: "aluno", ativo: true, removido_em: null, removido_por: null, motivo_remocao: null },
    create: { id: IDS.aluno, email: EMAILS.aluno, role: "aluno" },
  });

  await prisma.users.upsert({
    where: { email: EMAILS.suporte },
    update: { id: IDS.suporte, role: "suporte", ativo: true, removido_em: null, removido_por: null, motivo_remocao: null },
    create: { id: IDS.suporte, email: EMAILS.suporte, role: "suporte" },
  });

  await prisma.gestores.upsert({
    where: { user_id_empresa_id: { user_id: IDS.gestor, empresa_id: IDS.company } },
    update: { nome: "Maria Fernanda" },
    create: {
      id: "33333333-3333-3333-3333-333333333333",
      user_id: IDS.gestor,
      empresa_id: IDS.company,
      nome: "Maria Fernanda",
      telefone: "(55) 99999-0001",
    },
  });

  await prisma.colaboradores.upsert({
    where: { user_id_empresa_id: { user_id: IDS.professor, empresa_id: IDS.company } },
    update: {
      id: IDS.colaborador,
      nome: "Ana Paula Ferreira",
      cargo: "Professor",
      regime: "clt",
      salario_bruto: "3800.00",
      ativo: true,
    },
    create: {
      id: IDS.colaborador,
      user_id: IDS.professor,
      empresa_id: IDS.company,
      nome: "Ana Paula Ferreira",
      cargo: "Professor",
      regime: "clt",
      salario_bruto: "3800.00",
      data_admissao: new Date("2024-02-01"),
      banco_horas_min: 200,
    },
  });

  await upsertById(
    prisma.responsaveis,
    IDS.responsavelProfile,
    { user_id: IDS.responsavel, nome: "Carla Almeida", telefone: "(55) 99999-0002" },
    { user_id: IDS.responsavel, nome: "Carla Almeida", telefone: "(55) 99999-0002" }
  );

  await upsertById(
    prisma.alunos,
    IDS.aluno,
    { user_id: IDS.aluno, responsavel_id: IDS.responsavelProfile, nome: "Sofia Almeida", data_nascimento: new Date("2018-03-15"), ativo: true },
    { user_id: IDS.aluno, responsavel_id: IDS.responsavelProfile, nome: "Sofia Almeida", data_nascimento: new Date("2018-03-15"), ativo: true }
  );

  await prisma.turmas.upsert({
    where: { id: IDS.turma },
    update: {
      empresa_id: IDS.company,
      professor_id: IDS.colaborador,
      nome: "Ballet Infantil B",
      modalidade: "Ballet",
      dias_semana: [6],
      hora_inicio: new Date("1970-01-01T09:00:00Z"),
      hora_fim: new Date("1970-01-01T10:30:00Z"),
      sala: "Sala 2",
      vagas_total: 12,
      mensalidade: "280.00",
      ativa: true,
    },
    create: {
      id: IDS.turma,
      empresa_id: IDS.company,
      professor_id: IDS.colaborador,
      nome: "Ballet Infantil B",
      modalidade: "Ballet",
      dias_semana: [6],
      hora_inicio: new Date("1970-01-01T09:00:00Z"),
      hora_fim: new Date("1970-01-01T10:30:00Z"),
      sala: "Sala 2",
      vagas_total: 12,
      mensalidade: "280.00",
    },
  });

  await prisma.professor_turmas.upsert({
    where: { professor_id_turma_id: { professor_id: IDS.colaborador, turma_id: IDS.turma } },
    update: { pode_fazer_chamada: true, concedido_por: IDS.gestor },
    create: { professor_id: IDS.colaborador, turma_id: IDS.turma, concedido_por: IDS.gestor },
  });

  const matricula = await prisma.matriculas.findFirst({
    where: { aluno_id: IDS.aluno, turma_id: IDS.turma },
  });

  if (matricula) {
    await prisma.matriculas.update({
      where: { id: matricula.id },
      data: { dia_vencimento: 5, status: "ativa" },
    });
  } else {
    await prisma.matriculas.create({
      data: {
        aluno_id: IDS.aluno,
        turma_id: IDS.turma,
        dia_vencimento: 5,
      },
    });
  }

  await prisma.aulas.upsert({
    where: { turma_id_data: { turma_id: IDS.turma, data: new Date("2026-05-24") } },
    update: { topico: "Variações de Barra", cancelada: false },
    create: { id: IDS.aula, turma_id: IDS.turma, data: new Date("2026-05-24"), topico: "Variações de Barra" },
  });

  await prisma.registros_frequencia.upsert({
    where: { aula_id_aluno_id: { aula_id: IDS.aula, aluno_id: IDS.aluno } },
    update: { presente: true, registrado_por: IDS.colaborador },
    create: { aula_id: IDS.aula, aluno_id: IDS.aluno, presente: true, registrado_por: IDS.colaborador },
  });

  await prisma.holerites.upsert({
    where: { colaborador_id_mes_ano: { colaborador_id: IDS.colaborador, mes: 5, ano: 2026 } },
    update: { salario_bruto: "3800.00", inss: "342.00", irrf: "218.40" },
    create: {
      colaborador_id: IDS.colaborador,
      mes: 5,
      ano: 2026,
      salario_bruto: "3800.00",
      inss: "342.00",
      irrf: "218.40",
    },
  });

  await prisma.contratos_escola.upsert({
    where: { empresa_id: IDS.company },
    update: {
      plano: "growth",
      status: "ativo",
      aceite_termos: true,
      aceite_em: new Date(),
    },
    create: {
      empresa_id: IDS.company,
      plano: "growth",
      status: "ativo",
      aceite_termos: true,
      aceite_em: new Date(),
    },
  });

  await prisma.user_settings.upsert({
    where: { user_id: IDS.suporte },
    update: {
      biometria_ativa: false,
      som_marcacao: true,
      notif_push: true,
      tema: "light",
      idioma: "pt-BR",
    },
    create: { user_id: IDS.suporte },
  });

  await prisma.cobrancas.upsert({
    where: { matricula_id_referencia_mes_referencia_ano: { matricula_id: IDS.matricula, referencia_mes: 3, referencia_ano: 2026 } },
    update: { valor: "280.00", vencimento: new Date("2026-05-20"), status: "pendente", desconto: "0", pago_em: null, pago_valor: null },
    create: { matricula_id: IDS.matricula, referencia_mes: 3, referencia_ano: 2026, valor: "280.00", vencimento: new Date("2026-05-20"), status: "pendente" },
  });

  await prisma.cobrancas.upsert({
    where: { matricula_id_referencia_mes_referencia_ano: { matricula_id: IDS.matricula, referencia_mes: 5, referencia_ano: 2026 } },
    update: { valor: "280.00", vencimento: new Date("2026-05-05"), status: "pago", pago_em: new Date("2026-05-06T10:00:00Z"), pago_valor: "280.00" },
    create: { matricula_id: IDS.matricula, referencia_mes: 5, referencia_ano: 2026, valor: "280.00", vencimento: new Date("2026-05-05"), status: "pago", pago_em: new Date("2026-05-06T10:00:00Z"), pago_valor: "280.00" },
  });

  await prisma.cobrancas.upsert({
    where: { matricula_id_referencia_mes_referencia_ano: { matricula_id: IDS.matricula, referencia_mes: 6, referencia_ano: 2026 } },
    update: { valor: "280.00", vencimento: new Date("2026-06-05"), status: "pendente", desconto: "0", pago_em: null, pago_valor: null },
    create: { matricula_id: IDS.matricula, referencia_mes: 6, referencia_ano: 2026, valor: "280.00", vencimento: new Date("2026-06-05"), status: "pendente" },
  });

  await prisma.cobrancas.upsert({
    where: { matricula_id_referencia_mes_referencia_ano: { matricula_id: IDS.matricula, referencia_mes: 7, referencia_ano: 2026 } },
    update: { valor: "280.00", vencimento: new Date("2026-07-05"), status: "pendente", desconto: "0", pago_em: null, pago_valor: null },
    create: { matricula_id: IDS.matricula, referencia_mes: 7, referencia_ano: 2026, valor: "280.00", vencimento: new Date("2026-07-05"), status: "pendente" },
  });

  await ensureAuthUser(IDS.gestor, EMAILS.gestor, PASSWORDS.gestor);
  await ensureAuthUser(IDS.professor, EMAILS.professor, PASSWORDS.professor);
  await ensureAuthUser(IDS.responsavel, EMAILS.responsavel, PASSWORDS.responsavel);
  await ensureAuthUser(IDS.aluno, EMAILS.aluno, PASSWORDS.aluno);
  await ensureAuthUser(IDS.suporte, EMAILS.suporte, PASSWORDS.suporte);

  console.log(
    JSON.stringify(
      {
        ok: true,
        users: Object.values(EMAILS).length,
        company: IDS.company,
        turma: IDS.turma,
        matricula: IDS.matricula,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
