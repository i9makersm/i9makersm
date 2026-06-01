-- ============================================================
-- ERP Educacional — Schema PostgreSQL Completo e Definitivo
-- Supabase / PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE role_usuario    AS ENUM ('suporte','gestor','professor','colaborador','responsavel','aluno');
CREATE TYPE regime_trabalho AS ENUM ('clt','pj','estagio');
CREATE TYPE tipo_marcacao   AS ENUM ('entrada','inicio_intervalo','fim_intervalo','saida');
CREATE TYPE status_matricula AS ENUM ('ativa','cancelada','suspensa','inadimplente');
CREATE TYPE status_cobranca  AS ENUM ('pendente','pago','vencido','cancelado');

-- USERS (espelho do Supabase Auth)
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL UNIQUE,
  role       role_usuario NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EMPRESAS
CREATE TABLE empresas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL,
  cnpj       TEXT UNIQUE,
  segmento   TEXT,
  logo_url   TEXT,
  telefone   TEXT,
  email      TEXT,
  endereco   JSONB,
  plano      TEXT DEFAULT 'starter',
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CONVITES (links únicos hierárquicos)
CREATE TABLE convites (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token          UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  empresa_id     UUID NOT NULL REFERENCES empresas(id),
  criado_por     UUID NOT NULL REFERENCES users(id),
  role_destino   role_usuario NOT NULL,
  email_destino  TEXT,
  nome_destino   TEXT,
  metadata       JSONB DEFAULT '{}',
  usado          BOOLEAN NOT NULL DEFAULT false,
  user_criado    UUID REFERENCES users(id),
  expira_em      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_convites_token ON convites (token) WHERE NOT usado;

-- GESTORES
CREATE TABLE gestores (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cpf        TEXT,
  telefone   TEXT,
  UNIQUE(user_id, empresa_id)
);

-- COLABORADORES
CREATE TABLE colaboradores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  cpf               TEXT UNIQUE,
  cargo             TEXT NOT NULL,
  regime            regime_trabalho NOT NULL DEFAULT 'clt',
  salario_bruto     NUMERIC(10,2),
  data_admissao     DATE,
  banco_horas_min   INTEGER NOT NULL DEFAULT 0,
  carga_horaria_min INTEGER NOT NULL DEFAULT 480,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- REGISTROS DE PONTO (imutáveis)
CREATE TABLE registros_ponto (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
  tipo           tipo_marcacao NOT NULL,
  registrado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude       NUMERIC(9,6),
  longitude      NUMERIC(9,6),
  ip_origem      INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_colab_data ON registros_ponto(colaborador_id, registrado_em DESC);

-- FÉRIAS
CREATE TABLE ferias (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
  saldo_dias     INTEGER NOT NULL DEFAULT 0,
  proporcionais  INTEGER NOT NULL DEFAULT 0,
  periodo_inicio DATE,
  periodo_fim    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HOLERITES
CREATE TABLE holerites (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id   UUID NOT NULL REFERENCES colaboradores(id),
  mes              SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano              SMALLINT NOT NULL,
  salario_bruto    NUMERIC(10,2) NOT NULL,
  inss             NUMERIC(10,2) NOT NULL DEFAULT 0,
  irrf             NUMERIC(10,2) NOT NULL DEFAULT 0,
  outros_descontos NUMERIC(10,2) NOT NULL DEFAULT 0,
  salario_liquido  NUMERIC(10,2) GENERATED ALWAYS AS
                   (salario_bruto - inss - irrf - outros_descontos) STORED,
  pdf_url          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(colaborador_id, mes, ano)
);

-- RESPONSÁVEIS
CREATE TABLE responsaveis (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  cpf       TEXT UNIQUE,
  telefone  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ALUNOS
CREATE TABLE alunos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  responsavel_id  UUID REFERENCES responsaveis(id),
  nome            TEXT NOT NULL,
  data_nascimento DATE,
  foto_url        TEXT,
  observacoes     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TURMAS
CREATE TABLE turmas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id),
  professor_id  UUID REFERENCES colaboradores(id),
  nome          TEXT NOT NULL,
  modalidade    TEXT,
  dias_semana   INTEGER[],
  hora_inicio   TIME NOT NULL,
  hora_fim      TIME NOT NULL,
  sala          TEXT,
  vagas_total   SMALLINT NOT NULL DEFAULT 20,
  mensalidade   NUMERIC(10,2) NOT NULL,
  ativa         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROFESSOR_TURMAS (permissão do gestor)
CREATE TABLE professor_turmas (
  professor_id       UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  turma_id           UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  pode_fazer_chamada BOOLEAN NOT NULL DEFAULT true,
  concedido_por      UUID REFERENCES users(id),
  concedido_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (professor_id, turma_id)
);

-- MATRÍCULAS
CREATE TABLE matriculas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aluno_id        UUID NOT NULL REFERENCES alunos(id),
  turma_id        UUID NOT NULL REFERENCES turmas(id),
  data_inicio     DATE NOT NULL DEFAULT CURRENT_DATE,
  status          status_matricula NOT NULL DEFAULT 'ativa',
  dia_vencimento  SMALLINT NOT NULL DEFAULT 10,
  desconto_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, turma_id)
);

-- AULAS
CREATE TABLE aulas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id   UUID NOT NULL REFERENCES turmas(id),
  data       DATE NOT NULL,
  topico     TEXT,
  cancelada  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(turma_id, data)
);

-- REGISTROS DE FREQUÊNCIA
CREATE TABLE registros_frequencia (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id        UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  aluno_id       UUID NOT NULL REFERENCES alunos(id),
  presente       BOOLEAN NOT NULL,
  registrado_por UUID REFERENCES colaboradores(id),
  registrado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(aula_id, aluno_id)
);
CREATE INDEX idx_freq_aluno ON registros_frequencia(aluno_id, registrado_em DESC);

-- ATIVIDADES DE AULA
CREATE TABLE atividades_aula (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id     UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  criado_por  UUID REFERENCES colaboradores(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COBRANÇAS
CREATE TABLE cobrancas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula_id    UUID NOT NULL REFERENCES matriculas(id),
  referencia_mes  SMALLINT NOT NULL CHECK (referencia_mes BETWEEN 1 AND 12),
  referencia_ano  SMALLINT NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  desconto        NUMERIC(10,2) NOT NULL DEFAULT 0,
  vencimento      DATE NOT NULL,
  status          status_cobranca NOT NULL DEFAULT 'pendente',
  pix_copia_cola  TEXT,
  boleto_url      TEXT,
  pago_em         TIMESTAMPTZ,
  pago_valor      NUMERIC(10,2),
  gateway_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(matricula_id, referencia_mes, referencia_ano)
);
CREATE INDEX idx_cobrancas_venc ON cobrancas(vencimento, status);

-- VIEWS
CREATE OR REPLACE VIEW v_ponto_diario AS
SELECT colaborador_id, DATE(registrado_em) AS data,
  MAX(CASE WHEN tipo='entrada'          THEN registrado_em END) AS entrada,
  MAX(CASE WHEN tipo='inicio_intervalo' THEN registrado_em END) AS inicio_intervalo,
  MAX(CASE WHEN tipo='fim_intervalo'    THEN registrado_em END) AS fim_intervalo,
  MAX(CASE WHEN tipo='saida'            THEN registrado_em END) AS saida
FROM registros_ponto
GROUP BY colaborador_id, DATE(registrado_em);

CREATE OR REPLACE VIEW v_frequencia_aluno AS
SELECT m.aluno_id, m.turma_id, a.nome AS aluno_nome, t.nome AS turma_nome,
  COUNT(rf.id)::INT AS presencas,
  COUNT(au.id)::INT AS total_aulas,
  ROUND(COUNT(rf.id)*100.0/NULLIF(COUNT(au.id),0),1) AS percentual
FROM matriculas m
JOIN alunos a ON a.id=m.aluno_id
JOIN turmas t ON t.id=m.turma_id
JOIN aulas au ON au.turma_id=m.turma_id AND au.cancelada=false
LEFT JOIN registros_frequencia rf ON rf.aula_id=au.id AND rf.aluno_id=m.aluno_id AND rf.presente=true
WHERE m.status='ativa'
GROUP BY m.aluno_id,m.turma_id,a.nome,t.nome;

-- RLS
ALTER TABLE turmas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_frequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobrancas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE holerites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites             ENABLE ROW LEVEL SECURITY;

-- Dados de teste
INSERT INTO empresas (nome,cnpj,segmento,email,plano) VALUES
('Studio Arte em Movimento','11.222.333/0001-44','Escola de Dança','contato@arteemmovimento.com','growth'),
('Lab Maker Marista','22.333.444/0001-55','Escola de Robótica','contato@labmaker.com','pro');
