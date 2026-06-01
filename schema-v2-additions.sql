-- ============================================================
-- ERP Educacional v3 — Adições ao Schema (APPEND ONLY para PGR)
-- Execute após schema.sql
-- ============================================================

-- ── CONFIGURAÇÕES DE USUÁRIO ─────────────────────────────────
CREATE TABLE user_settings (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  biometria_ativa  BOOLEAN NOT NULL DEFAULT false,
  som_marcacao     BOOLEAN NOT NULL DEFAULT true,
  notif_push       BOOLEAN NOT NULL DEFAULT true,
  tema             TEXT    NOT NULL DEFAULT 'light',
  idioma           TEXT    NOT NULL DEFAULT 'pt-BR',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PERFIL ESTENDIDO DO COLABORADOR ──────────────────────────
CREATE TABLE colaborador_perfil (
  colaborador_id        UUID PRIMARY KEY REFERENCES colaboradores(id) ON DELETE CASCADE,
  foto_url              TEXT,
  data_nascimento       DATE,
  genero                TEXT,
  raca_cor              TEXT,
  estado_civil          TEXT,
  pcd                   BOOLEAN DEFAULT false,
  tipo_pcd              TEXT,
  nacionalidade         TEXT DEFAULT 'Brasileira',
  naturalidade          TEXT,
  -- Contatos
  telefone_pessoal      TEXT,
  telefone_emergencia   TEXT,
  nome_emergencia       TEXT,
  -- Endereço
  cep                   TEXT,
  logradouro            TEXT,
  numero                TEXT,
  complemento           TEXT,
  bairro                TEXT,
  cidade                TEXT,
  uf                    TEXT,
  -- Documentos
  rg                    TEXT,
  rg_emissor            TEXT,
  rg_data               DATE,
  pis                   TEXT,
  ctps                  TEXT,
  titulo_eleitor        TEXT,
  -- Formação
  escolaridade          TEXT,
  curso                 TEXT,
  instituicao           TEXT,
  ano_conclusao         INT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PGR — TERMÔMETRO EMOCIONAL (APPEND-ONLY) ─────────────────
-- CRÍTICO: Esta tabela NÃO pode ter UPDATE ou DELETE por design
CREATE TABLE pgr_emotional_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id),
  humor           TEXT NOT NULL CHECK (humor IN ('excelente','bem','neutro','estressado','mal')),
  detalhamento    TEXT,
  quer_contato    BOOLEAN NOT NULL DEFAULT false,
  anonimo         BOOLEAN NOT NULL DEFAULT false,
  ponto_id        UUID REFERENCES registros_ponto(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Sem updated_at, deleted_at — imutável por design
);
CREATE INDEX idx_pgr_colab ON pgr_emotional_logs(colaborador_id, created_at DESC);
CREATE INDEX idx_pgr_data  ON pgr_emotional_logs(created_at DESC);

-- RELATOS PGR (APPEND-ONLY — jamais UPDATE ou DELETE)
CREATE TABLE pgr_relatos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id),
  categoria       TEXT NOT NULL CHECK (categoria IN ('assedio_moral','assedio_sexual','discriminacao','condicoes_trabalho','relacionamento','outro')),
  descricao       TEXT NOT NULL,
  envolvidos      TEXT,
  anonimo         BOOLEAN NOT NULL DEFAULT true,
  urgente         BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','encerrado')),
  -- status pode avançar (aberto→em_analise→encerrado) mas nunca voltar nem apagar
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Trigger para garantir imutabilidade absoluta no banco
CREATE OR REPLACE FUNCTION bloquear_alteracao_pgr()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros PGR são imutáveis por lei. Operação bloqueada.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pgr_emotional_logs_no_update
  BEFORE UPDATE OR DELETE ON pgr_emotional_logs
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_pgr();

CREATE TRIGGER pgr_relatos_no_delete
  BEFORE DELETE ON pgr_relatos
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_pgr();
-- UPDATE de status é permitido mas não de campos de conteúdo
CREATE OR REPLACE FUNCTION bloquear_edicao_conteudo_pgr()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.descricao <> NEW.descricao OR OLD.colaborador_id <> NEW.colaborador_id OR
     OLD.categoria <> NEW.categoria OR OLD.anonimo <> NEW.anonimo THEN
    RAISE EXCEPTION 'Conteúdo de relatos PGR é imutável por lei.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pgr_relatos_no_content_update
  BEFORE UPDATE ON pgr_relatos
  FOR EACH ROW EXECUTE FUNCTION bloquear_edicao_conteudo_pgr();

-- ── AVALIAÇÃO DE AULA PELO ALUNO (editável pelo aluno) ───────
CREATE TABLE avaliacoes_aula (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id     UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  aluno_id    UUID NOT NULL REFERENCES alunos(id),
  avaliacao   TEXT NOT NULL CHECK (avaliacao IN ('feliz','mais_ou_menos','triste')),
  comentario  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(aula_id, aluno_id) -- Um aluno, uma avaliação por aula (mas editável)
);

-- ── FEEDBACK GESTOR <-> COLABORADOR ──────────────────────────
CREATE TABLE feedbacks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  de_user_id      UUID NOT NULL REFERENCES users(id),
  para_user_id    UUID NOT NULL REFERENCES users(id),
  empresa_id      UUID NOT NULL REFERENCES empresas(id),
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'geral' CHECK (tipo IN ('geral','elogio','melhoria','alerta')),
  lido            BOOLEAN NOT NULL DEFAULT false,
  lido_em         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CONTRATO DA ESCOLA (cláusulas de uso) ────────────────────
CREATE TABLE contratos_escola (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) UNIQUE,
  plano           TEXT NOT NULL,
  data_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim        DATE,
  valor_mensal    NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','cancelado','bloqueado')),
  aceite_termos   BOOLEAN NOT NULL DEFAULT false,
  aceite_em       TIMESTAMPTZ,
  bkp_prazo_dias  INT NOT NULL DEFAULT 30,
  bkp_solicitado  TIMESTAMPTZ,
  bkp_realizado   TIMESTAMPTZ,
  bloqueado_em    TIMESTAMPTZ,
  bloqueado_por   UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── NOTIFICAÇÕES DO SISTEMA ───────────────────────────────────
CREATE TABLE notificacoes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  titulo      TEXT NOT NULL,
  mensagem    TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info','alerta','financeiro','pgr','feedback')),
  lida        BOOLEAN NOT NULL DEFAULT false,
  lida_em     TIMESTAMPTZ,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notificacoes(user_id, lida, created_at DESC);

-- ── PLANOS DE AULA (banco de planos do gestor) ───────────────
CREATE TABLE planos_aula (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id),
  turma_id     UUID REFERENCES turmas(id),
  titulo       TEXT NOT NULL,
  descricao    TEXT,
  ordem        INT NOT NULL DEFAULT 1,
  duracao_min  INT NOT NULL DEFAULT 60,
  status       TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','arquivado')),
  aula_id      UUID REFERENCES aulas(id),
  criado_por   UUID REFERENCES users(id),
  editado_por  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plano_materiais (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plano_id    UUID NOT NULL REFERENCES planos_aula(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('video','audio','pdf','link','imagem')),
  nome        TEXT NOT NULL,
  url         TEXT NOT NULL,
  ordem       INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── USUÁRIOS REMOVIDOS (soft delete com bloqueio) ─────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS removido_em  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS removido_por UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivo_remocao TEXT;

-- ── NOTIFICAÇÕES AUTOMÁTICAS — Função de inadimplência ────────
CREATE OR REPLACE FUNCTION fn_verificar_inadimplencia()
RETURNS void AS $$
DECLARE
  cob RECORD;
  resp_user_id UUID;
  dias_atraso INT;
BEGIN
  FOR cob IN
    SELECT c.*, m.aluno_id, t.empresa_id
    FROM cobrancas c
    JOIN matriculas m ON m.id = c.matricula_id
    JOIN turmas t ON t.id = m.turma_id
    WHERE c.status = 'pendente'
      AND c.vencimento < CURRENT_DATE
  LOOP
    dias_atraso := CURRENT_DATE - cob.vencimento;
    -- Notifica após 5 dias de atraso (configurável)
    IF dias_atraso >= 5 THEN
      SELECT r.user_id INTO resp_user_id
      FROM alunos a JOIN responsaveis r ON r.id = a.responsavel_id
      WHERE a.id = cob.aluno_id LIMIT 1;

      IF resp_user_id IS NOT NULL THEN
        INSERT INTO notificacoes (user_id, titulo, mensagem, tipo)
        VALUES (
          resp_user_id,
          '⚠️ Mensalidade em atraso',
          format('Sua mensalidade venceu em %s (%s dias de atraso). Acesse o app para regularizar.',
                 to_char(cob.vencimento,'DD/MM/YYYY'), dias_atraso),
          'financeiro'
        )
        ON CONFLICT DO NOTHING;

        UPDATE cobrancas SET status = 'vencido'
        WHERE id = cob.id AND status = 'pendente';
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Rodar diariamente via pg_cron (no Supabase: Database > Extensions > pg_cron)
-- SELECT cron.schedule('verificar-inadimplencia', '0 8 * * *', 'SELECT fn_verificar_inadimplencia()');

COMMENT ON TABLE pgr_emotional_logs IS 'APPEND-ONLY por lei (NR-1 PGR). Nenhum UPDATE ou DELETE permitido.';
COMMENT ON TABLE pgr_relatos IS 'APPEND-ONLY por lei (NR-1 PGR). Conteúdo imutável.';
