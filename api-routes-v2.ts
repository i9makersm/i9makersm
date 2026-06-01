/**
 * ERP Educacional — API Routes v2
 * Novos endpoints: PGR, Avaliação de Aula, Feedback,
 * Perfil do Colaborador, Planos de Aula, Notificações,
 * Configurações de Usuário, Contratos de Escola
 */

import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Middleware de Auth ────────────────────────────────────────────────────────
async function auth(req: any, reply: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return reply.status(401).send({ error: "Token ausente" });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return reply.status(401).send({ error: "Não autenticado" });
  const user = await prisma.users.findUnique({ where: { id: data.user.id } });
  if (!user || !user.ativo || user.removido_em)
    return reply.status(403).send({ error: "Acesso bloqueado" });
  req.user = user;
}

function role(...roles: string[]) {
  return async (req: any, reply: any) => {
    if (!roles.includes(req.user?.role))
      return reply.status(403).send({ error: `Perfil ${req.user?.role} sem acesso` });
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PGR — TERMÔMETRO EMOCIONAL (APPEND-ONLY por lei)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /pgr/humor
 * Colaborador registra estado emocional após ponto.
 * APPEND-ONLY: nenhum UPDATE ou DELETE é possível.
 */
app.post("/pgr/humor", { preHandler: [auth, role("colaborador", "professor_colab")] },
  async (req: any, reply) => {
    const body = z.object({
      humor: z.enum(["excelente", "bem", "neutro", "estressado", "mal"]),
      detalhamento: z.string().optional(),
      quer_contato: z.boolean().default(false),
      anonimo: z.boolean().default(false),
      ponto_id: z.string().uuid().optional(),
    }).parse(req.body);

    const colab = await prisma.colaboradores.findFirst({ where: { user_id: req.user.id } });
    if (!colab) return reply.status(404).send({ error: "Colaborador não encontrado" });

    // SOMENTE INSERT — nunca UPDATE ou DELETE
    const log = await prisma.pgr_emotional_logs.create({
      data: {
        colaborador_id: colab.id,
        humor: body.humor,
        detalhamento: body.detalhamento,
        quer_contato: body.quer_contato,
        anonimo: body.anonimo,
        ponto_id: body.ponto_id,
      },
    });

    // Notifica RH se quiser contato
    if (body.quer_contato) {
      const gestores = await prisma.gestores.findMany({
        where: { empresa_id: colab.empresa_id },
      });
      for (const g of gestores) {
        await prisma.notificacoes.create({
          data: {
            user_id: g.user_id,
            titulo: "🔔 Colaborador solicita contato (PGR)",
            mensagem: body.anonimo
              ? "Um colaborador registrou estado emocional negativo e solicita contato do RH."
              : `${colab.nome} registrou estado emocional negativo e solicita contato do RH.`,
            tipo: "pgr",
          },
        });
      }
    }

    return reply.status(201).send({ id: log.id, registrado_em: log.created_at });
  }
);

/**
 * POST /pgr/relato
 * Colaborador registra relato/ocorrência PGR.
 * CONTEÚDO IMUTÁVEL — trigger no banco bloqueia UPDATE de campos críticos.
 */
app.post("/pgr/relato", { preHandler: [auth, role("colaborador", "professor_colab")] },
  async (req: any, reply) => {
    const body = z.object({
      categoria: z.enum(["assedio_moral", "assedio_sexual", "discriminacao", "condicoes_trabalho", "relacionamento", "outro"]),
      descricao: z.string().min(20, "Descreva com pelo menos 20 caracteres"),
      envolvidos: z.string().optional(),
      anonimo: z.boolean().default(true),
      urgente: z.boolean().default(false),
    }).parse(req.body);

    const colab = await prisma.colaboradores.findFirst({ where: { user_id: req.user.id } });
    if (!colab) return reply.status(404).send({ error: "Colaborador não encontrado" });

    const relato = await prisma.pgr_relatos.create({
      data: {
        colaborador_id: colab.id,
        categoria: body.categoria,
        descricao: body.descricao,
        envolvidos: body.envolvidos,
        anonimo: body.anonimo,
        urgente: body.urgente,
        status: "aberto",
      },
    });

    // Alerta imediato para gestores/RH
    const gestores = await prisma.gestores.findMany({ where: { empresa_id: colab.empresa_id } });
    for (const g of gestores) {
      await prisma.notificacoes.create({
        data: {
          user_id: g.user_id,
          titulo: body.urgente ? "🚨 URGENTE — Novo relato PGR" : "⚠️ Novo relato PGR registrado",
          mensagem: `Categoria: ${body.categoria}. ${body.urgente ? "Requer atenção imediata." : "Verifique o painel de compliance."}`,
          tipo: "pgr",
        },
      });
    }

    return reply.status(201).send({ id: relato.id, status: relato.status });
  }
);

/**
 * GET /pgr/dashboard
 * Gestor/RH vê dados agrupados e anônimos da equipe.
 */
app.get("/pgr/dashboard", { preHandler: [auth, role("gestor", "suporte")] },
  async (req: any, reply) => {
    const g = await prisma.gestores.findFirst({ where: { user_id: req.user.id } });
    const empresa_id = g?.empresa_id ?? (req.query as any).empresa_id;

    const logs = await prisma.pgr_emotional_logs.findMany({
      where: {
        colaboradores: { empresa_id },
        created_at: { gte: new Date(Date.now() - 30 * 86400000) },
      },
    });

    const resumo = {
      excelente: logs.filter(l => l.humor === "excelente").length,
      bem:        logs.filter(l => l.humor === "bem").length,
      neutro:     logs.filter(l => l.humor === "neutro").length,
      estressado: logs.filter(l => l.humor === "estressado").length,
      mal:        logs.filter(l => l.humor === "mal").length,
      quer_contato: logs.filter(l => l.quer_contato && !l.anonimo).length,
    };

    const relatos_abertos = await prisma.pgr_relatos.count({
      where: { status: "aberto", colaboradores: { empresa_id } },
    });

    return reply.send({ resumo, relatos_abertos, periodo: "30 dias" });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// AVALIAÇÃO DE AULA PELO ALUNO (editável)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /avaliacoes/aula/:aula_id
 * Aluno avalia a aula. Pode atualizar quando quiser (UPSERT).
 */
app.post("/avaliacoes/aula/:aula_id", { preHandler: [auth, role("aluno")] },
  async (req: any, reply) => {
    const { aula_id } = req.params as any;
    const body = z.object({
      avaliacao: z.enum(["feliz", "mais_ou_menos", "triste"]),
      comentario: z.string().optional(),
    }).parse(req.body);

    const aluno = await prisma.alunos.findFirst({ where: { user_id: req.user.id } });
    if (!aluno) return reply.status(404).send({ error: "Aluno não encontrado" });

    // UPSERT — aluno pode alterar quando quiser
    const aval = await prisma.avaliacoes_aula.upsert({
      where: { aula_id_aluno_id: { aula_id, aluno_id: aluno.id } },
      create: { aula_id, aluno_id: aluno.id, avaliacao: body.avaliacao, comentario: body.comentario },
      update: { avaliacao: body.avaliacao, comentario: body.comentario, updated_at: new Date() },
    });

    return reply.status(200).send({ id: aval.id, avaliacao: aval.avaliacao });
  }
);

/**
 * GET /avaliacoes/turma/:turma_id
 * Gestor/professor vê avaliações agrupadas da turma.
 */
app.get("/avaliacoes/turma/:turma_id", { preHandler: [auth] }, async (req: any, reply) => {
  const { turma_id } = req.params as any;
  const avals = await prisma.avaliacoes_aula.findMany({
    where: { aulas: { turma_id } },
    include: { aulas: { select: { data: true, topico: true } } },
  });

  const resumo = {
    feliz:         avals.filter(a => a.avaliacao === "feliz").length,
    mais_ou_menos: avals.filter(a => a.avaliacao === "mais_ou_menos").length,
    triste:        avals.filter(a => a.avaliacao === "triste").length,
  };

  return reply.send({ resumo, total: avals.length });
});

// ════════════════════════════════════════════════════════════════════════════
// FEEDBACKS
// ════════════════════════════════════════════════════════════════════════════

app.post("/feedbacks", { preHandler: [auth] }, async (req: any, reply) => {
  const body = z.object({
    para_user_id: z.string().uuid(),
    titulo: z.string().min(3),
    mensagem: z.string().min(10),
    tipo: z.enum(["geral", "elogio", "melhoria", "alerta"]).default("geral"),
  }).parse(req.body);

  const colab = await prisma.colaboradores.findFirst({ where: { user_id: req.user.id } });
  const empresa_id = colab?.empresa_id;
  if (!empresa_id) return reply.status(422).send({ error: "Empresa não identificada" });

  const fb = await prisma.feedbacks.create({
    data: {
      de_user_id: req.user.id,
      para_user_id: body.para_user_id,
      empresa_id,
      titulo: body.titulo,
      mensagem: body.mensagem,
      tipo: body.tipo,
    },
  });

  // Notificação
  await prisma.notificacoes.create({
    data: {
      user_id: body.para_user_id,
      titulo: `💬 Novo feedback: ${body.titulo}`,
      mensagem: body.mensagem.substring(0, 100),
      tipo: "feedback",
      link: `/feedbacks/${fb.id}`,
    },
  });

  return reply.status(201).send({ id: fb.id });
});

app.get("/feedbacks", { preHandler: [auth] }, async (req: any, reply) => {
  const feedbacks = await prisma.feedbacks.findMany({
    where: { OR: [{ de_user_id: req.user.id }, { para_user_id: req.user.id }] },
    orderBy: { created_at: "desc" },
    take: 50,
  });
  return reply.send({ data: feedbacks });
});

// ════════════════════════════════════════════════════════════════════════════
// PERFIL DO COLABORADOR
// ════════════════════════════════════════════════════════════════════════════

app.get("/colaborador/perfil", { preHandler: [auth] }, async (req: any, reply) => {
  const colab = await prisma.colaboradores.findFirst({ where: { user_id: req.user.id } });
  if (!colab) return reply.status(404).send({ error: "Não encontrado" });

  const perfil = await prisma.colaborador_perfil.findUnique({ where: { colaborador_id: colab.id } });
  return reply.send({ colaborador: colab, perfil });
});

app.put("/colaborador/perfil", { preHandler: [auth] }, async (req: any, reply) => {
  const colab = await prisma.colaboradores.findFirst({ where: { user_id: req.user.id } });
  if (!colab) return reply.status(404).send({ error: "Não encontrado" });

  const body = z.object({
    foto_url: z.string().url().optional(),
    data_nascimento: z.string().optional(),
    genero: z.string().optional(),
    telefone_pessoal: z.string().optional(),
    telefone_emergencia: z.string().optional(),
    nome_emergencia: z.string().optional(),
    cep: z.string().optional(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
    escolaridade: z.string().optional(),
    curso: z.string().optional(),
  }).parse(req.body);

  const perfil = await prisma.colaborador_perfil.upsert({
    where: { colaborador_id: colab.id },
    create: { colaborador_id: colab.id, ...body as any },
    update: { ...body as any, updated_at: new Date() },
  });

  return reply.send({ data: perfil });
});

// Gestor/Suporte pode editar perfil de qualquer colaborador da empresa
app.put("/colaborador/:id/perfil", { preHandler: [auth, role("gestor", "suporte")] },
  async (req: any, reply) => {
    const { id } = req.params as any;
    const body = req.body as any;

    const perfil = await prisma.colaborador_perfil.upsert({
      where: { colaborador_id: id },
      create: { colaborador_id: id, ...body },
      update: { ...body, updated_at: new Date() },
    });

    return reply.send({ data: perfil });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PLANOS DE AULA
// ════════════════════════════════════════════════════════════════════════════

app.get("/planos", { preHandler: [auth] }, async (req: any, reply) => {
  const { turma_id } = req.query as any;
  const g = await prisma.gestores.findFirst({ where: { user_id: req.user.id } });
  const colab = await prisma.colaboradores.findFirst({ where: { user_id: req.user.id } });
  const empresa_id = g?.empresa_id ?? colab?.empresa_id;

  // Professor vê somente planos publicados de suas turmas
  const where: any = { empresa_id };
  if (turma_id) where.turma_id = turma_id;
  if (req.user.role === "professor" || req.user.role === "professor_colab") {
    where.status = "publicado";
  }

  const planos = await prisma.planos_aula.findMany({
    where,
    include: { plano_materiais: { orderBy: { ordem: "asc" } } },
    orderBy: [{ turma_id: "asc" }, { ordem: "asc" }],
  });

  return reply.send({ data: planos });
});

app.post("/planos", { preHandler: [auth, role("gestor", "suporte")] }, async (req: any, reply) => {
  const body = z.object({
    turma_id: z.string().uuid().optional(),
    titulo: z.string().min(3),
    descricao: z.string().optional(),
    ordem: z.number().int().default(1),
    duracao_min: z.number().int().default(60),
    status: z.enum(["rascunho", "publicado", "arquivado"]).default("rascunho"),
    materiais: z.array(z.object({
      tipo: z.enum(["video", "audio", "pdf", "link", "imagem"]),
      nome: z.string(),
      url: z.string().url(),
      ordem: z.number().int().default(1),
    })).optional(),
  }).parse(req.body);

  const g = await prisma.gestores.findFirst({ where: { user_id: req.user.id } });
  const empresa_id = g?.empresa_id ?? (req.body as any).empresa_id;

  const plano = await prisma.$transaction(async (tx) => {
    const p = await tx.planos_aula.create({
      data: {
        empresa_id,
        turma_id: body.turma_id,
        titulo: body.titulo,
        descricao: body.descricao,
        ordem: body.ordem,
        duracao_min: body.duracao_min,
        status: body.status,
        criado_por: req.user.id,
      },
    });

    if (body.materiais?.length) {
      await tx.plano_materiais.createMany({
        data: body.materiais.map(m => ({ ...m, plano_id: p.id })),
      });
    }

    return p;
  });

  return reply.status(201).send({ data: plano });
});

app.patch("/planos/:id/status", { preHandler: [auth, role("gestor", "suporte")] },
  async (req: any, reply) => {
    const { id } = req.params as any;
    const { status } = z.object({
      status: z.enum(["rascunho", "publicado", "arquivado"]),
    }).parse(req.body);

    const plano = await prisma.planos_aula.update({
      where: { id },
      data: { status, editado_por: req.user.id, updated_at: new Date() },
    });

    return reply.send({ data: plano });
  }
);

app.delete("/planos/:id", { preHandler: [auth, role("gestor", "suporte")] },
  async (req: any, reply) => {
    await prisma.planos_aula.update({
      where: { id: req.params.id },
      data: { status: "arquivado", editado_por: req.user.id },
    });
    return reply.send({ ok: true });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÕES
// ════════════════════════════════════════════════════════════════════════════

app.get("/notificacoes", { preHandler: [auth] }, async (req: any, reply) => {
  const notifs = await prisma.notificacoes.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: "desc" },
    take: 30,
  });
  return reply.send({
    data: notifs,
    nao_lidas: notifs.filter(n => !n.lida).length,
  });
});

app.patch("/notificacoes/:id/lida", { preHandler: [auth] }, async (req: any, reply) => {
  await prisma.notificacoes.update({
    where: { id: req.params.id, user_id: req.user.id },
    data: { lida: true, lida_em: new Date() },
  });
  return reply.send({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES DO USUÁRIO
// ════════════════════════════════════════════════════════════════════════════

app.get("/settings", { preHandler: [auth] }, async (req: any, reply) => {
  const s = await prisma.user_settings.findUnique({ where: { user_id: req.user.id } });
  return reply.send({
    data: s ?? {
      user_id: req.user.id, biometria_ativa: false,
      som_marcacao: true, notif_push: true, tema: "light", idioma: "pt-BR",
    },
  });
});

app.put("/settings", { preHandler: [auth] }, async (req: any, reply) => {
  const body = z.object({
    biometria_ativa: z.boolean().optional(),
    som_marcacao: z.boolean().optional(),
    notif_push: z.boolean().optional(),
    tema: z.string().optional(),
    idioma: z.string().optional(),
  }).parse(req.body);

  const s = await prisma.user_settings.upsert({
    where: { user_id: req.user.id },
    create: { user_id: req.user.id, ...body as any },
    update: { ...body as any, updated_at: new Date() },
  });

  return reply.send({ data: s });
});

// ════════════════════════════════════════════════════════════════════════════
// CONTRATOS DE ESCOLA (Suporte gerencia)
// ════════════════════════════════════════════════════════════════════════════

app.get("/contratos/:empresa_id", { preHandler: [auth, role("suporte")] },
  async (req: any, reply) => {
    const c = await prisma.contratos_escola.findUnique({
      where: { empresa_id: req.params.empresa_id },
    });
    return reply.send({ data: c });
  }
);

app.post("/contratos/:empresa_id/bloquear", { preHandler: [auth, role("suporte")] },
  async (req: any, reply) => {
    const { motivo } = req.body as any;
    const contrato = await prisma.contratos_escola.upsert({
      where: { empresa_id: req.params.empresa_id },
      create: {
        empresa_id: req.params.empresa_id,
        plano: "growth", status: "bloqueado",
        bloqueado_em: new Date(), bloqueado_por: req.user.id,
      },
      update: {
        status: "bloqueado",
        bloqueado_em: new Date(), bloqueado_por: req.user.id,
      },
    });

    // Bloqueia todos os usuários da empresa
    await prisma.users.updateMany({
      where: {
        OR: [
          { gestores: { some: { empresa_id: req.params.empresa_id } } },
          { colaboradores: { some: { empresa_id: req.params.empresa_id } } },
        ],
      },
      data: { ativo: false, removido_em: new Date(), motivo_remocao: motivo ?? "Escola bloqueada" },
    });

    return reply.send({ ok: true, status: contrato.status });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// REMOÇÃO DE USUÁRIOS (soft delete)
// ════════════════════════════════════════════════════════════════════════════

app.delete("/usuarios/:id", { preHandler: [auth, role("gestor", "suporte")] },
  async (req: any, reply) => {
    const { motivo } = req.body as any;

    // Suporte remove qualquer um; Gestor só remove da sua empresa
    if (req.user.role === "gestor") {
      const target = await prisma.colaboradores.findFirst({
        where: { user_id: req.params.id },
      });
      const g = await prisma.gestores.findFirst({ where: { user_id: req.user.id } });
      if (!target || target.empresa_id !== g?.empresa_id)
        return reply.status(403).send({ error: "Usuário não pertence à sua empresa" });
    }

    await prisma.users.update({
      where: { id: req.params.id },
      data: {
        ativo: false,
        removido_em: new Date(),
        removido_por: req.user.id,
        motivo_remocao: motivo ?? "Removido pelo gestor",
      },
    });

    // Revoga sessões no Supabase Auth
    await supabase.auth.admin.deleteUser(req.params.id);

    return reply.send({ ok: true, message: "Acesso bloqueado. Usuário não consegue mais entrar." });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// UPLOAD DE LOGO (Suporte — Supabase Storage)
// ════════════════════════════════════════════════════════════════════════════

app.post("/empresas/:id/logo", { preHandler: [auth, role("suporte")] },
  async (req: any, reply) => {
    const { base64, filename, mimetype } = req.body as any;

    if (!["image/jpeg", "image/png"].includes(mimetype))
      return reply.status(422).send({ error: "Apenas JPG e PNG permitidos" });

    const buffer = Buffer.from(base64, "base64");
    const path = `logos/${req.params.id}/${filename}`;

    const { error } = await supabase.storage.from("erp-assets").upload(path, buffer, {
      contentType: mimetype, upsert: true,
    });
    if (error) return reply.status(500).send({ error: "Falha no upload" });

    const { data: urlData } = supabase.storage.from("erp-assets").getPublicUrl(path);

    await prisma.empresas.update({
      where: { id: req.params.id },
      data: { logo_url: urlData.publicUrl },
    });

    return reply.send({ logo_url: urlData.publicUrl });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// INADIMPLÊNCIA — Notificação automática (chamada pelo cron)
// ════════════════════════════════════════════════════════════════════════════

app.post("/cron/verificar-inadimplencia", { preHandler: [auth, role("suporte")] },
  async (req: any, reply) => {
    // Busca cobranças vencidas há 5+ dias ainda como "pendente"
    const limite = new Date();
    limite.setDate(limite.getDate() - 5);

    const cobrancas = await prisma.cobrancas.findMany({
      where: { status: "pendente", vencimento: { lte: limite } },
      include: {
        matriculas: {
          include: {
            alunos: { include: { responsaveis: true } },
            turmas: { select: { nome: true } },
          },
        },
      },
    });

    let notificadas = 0;
    for (const cob of cobrancas) {
      const resp = cob.matriculas.alunos.responsaveis;
      if (!resp) continue;

      const dias = Math.floor((Date.now() - cob.vencimento.getTime()) / 86400000);

      await prisma.notificacoes.create({
        data: {
          user_id: resp.user_id,
          titulo: "⚠️ Mensalidade em atraso",
          mensagem: `A mensalidade de ${cob.matriculas.alunos.nome} venceu em ${cob.vencimento.toLocaleDateString("pt-BR")} (${dias} dias). Regularize pelo app.`,
          tipo: "financeiro",
        },
      });

      await prisma.cobrancas.update({
        where: { id: cob.id },
        data: { status: "vencido" },
      });

      notificadas++;
    }

    return reply.send({ notificadas });
  }
);

// START
app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
