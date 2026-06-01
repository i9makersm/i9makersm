-- ============================================================
-- ERP Educacional — Dados de Teste (Seed)
-- Execute após schema.sql para ter dados funcionais
-- ============================================================

-- Empresa de teste
INSERT INTO empresas (id, nome, cnpj, segmento, email, plano) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Studio Arte em Movimento', '11.222.333/0001-44', 'Escola de Dança', 'contato@arteemmovimento.com', 'growth'),
  ('a1b2c3d4-0001-0001-0001-000000000002', 'Lab Maker Marista',         '22.333.444/0001-55', 'Escola de Robótica', 'contato@labmaker.com', 'pro');

-- Users (senhas gerenciadas pelo Supabase Auth)
INSERT INTO users (id, email, role) VALUES
  ('u0000000-0000-0000-0000-000000000001', 'suporte@erp.com',       'suporte'),
  ('u0000000-0000-0000-0000-000000000002', 'gestor@arteemmovimento.com', 'gestor'),
  ('u0000000-0000-0000-0000-000000000003', 'anapaula@arteemmovimento.com', 'professor'),
  ('u0000000-0000-0000-0000-000000000004', 'carlos@arteemmovimento.com',   'colaborador'),
  ('u0000000-0000-0000-0000-000000000005', 'carla@email.com',       'responsavel'),
  ('u0000000-0000-0000-0000-000000000006', 'sofia@email.com',       'aluno');

-- Gestor
INSERT INTO gestores (id, user_id, empresa_id, nome, telefone) VALUES
  ('g0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002',
   'a1b2c3d4-0001-0001-0001-000000000001', 'Maria Fernanda', '(55) 99999-0001');

-- Colaboradores (inclui professor)
INSERT INTO colaboradores (id, user_id, empresa_id, nome, cargo, regime, salario_bruto, data_admissao, banco_horas_min) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000003',
   'a1b2c3d4-0001-0001-0001-000000000001', 'Ana Paula Ferreira', 'Professor', 'clt', 3800.00, '2024-02-01', 200),
  ('c0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000004',
   'a1b2c3d4-0001-0001-0001-000000000001', 'Carlos Lima', 'Instrutor', 'clt', 3500.00, '2023-03-15', 65);

-- Férias e holerites de teste
INSERT INTO ferias (colaborador_id, saldo_dias, proporcionais) VALUES
  ('c0000000-0000-0000-0000-000000000001', 15, 8),
  ('c0000000-0000-0000-0000-000000000002', 20, 4);

INSERT INTO holerites (colaborador_id, mes, ano, salario_bruto, inss, irrf) VALUES
  ('c0000000-0000-0000-0000-000000000001', 5, 2026, 3800.00, 342.00, 218.40),
  ('c0000000-0000-0000-0000-000000000001', 4, 2026, 3800.00, 342.00, 218.40),
  ('c0000000-0000-0000-0000-000000000001', 3, 2026, 3800.00, 342.00, 218.40);

-- Turmas
INSERT INTO turmas (id, empresa_id, professor_id, nome, modalidade, dias_semana, hora_inicio, hora_fim, sala, vagas_total, mensalidade) VALUES
  ('t0000000-0000-0000-0000-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'Ballet Infantil B', 'Ballet', ARRAY[6], '09:00', '10:30', 'Sala 2', 12, 280.00),
  ('t0000000-0000-0000-0000-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'Ballet Infantil A', 'Ballet', ARRAY[3,5], '08:00', '09:30', 'Sala 1', 12, 280.00);

-- Professor-turma
INSERT INTO professor_turmas (professor_id, turma_id, concedido_por) VALUES
  ('c0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000002');

-- Responsável e Alunos
INSERT INTO responsaveis (id, user_id, nome, telefone) VALUES
  ('r0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000005', 'Carla Almeida', '(55) 99999-0002');

INSERT INTO alunos (id, user_id, responsavel_id, nome, data_nascimento) VALUES
  ('al000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000006',
   'r0000000-0000-0000-0000-000000000001', 'Sofia Almeida', '2018-03-15'),
  ('al000000-0000-0000-0000-000000000002', NULL,
   'r0000000-0000-0000-0000-000000000001', 'Isabella Costa', '2017-07-20'),
  ('al000000-0000-0000-0000-000000000003', NULL,
   'r0000000-0000-0000-0000-000000000001', 'Laura Mendes', '2018-11-05');

-- Matrículas
INSERT INTO matriculas (id, aluno_id, turma_id, dia_vencimento) VALUES
  ('m0000000-0000-0000-0000-000000000001', 'al000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 5),
  ('m0000000-0000-0000-0000-000000000002', 'al000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000001', 5),
  ('m0000000-0000-0000-0000-000000000003', 'al000000-0000-0000-0000-000000000003', 't0000000-0000-0000-0000-000000000001', 5);

-- Aulas e frequências
INSERT INTO aulas (id, turma_id, data, topico) VALUES
  ('au000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', '2026-05-24', 'Variações de Barra'),
  ('au000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000001', '2026-05-17', 'Pliés e Relevés'),
  ('au000000-0000-0000-0000-000000000003', 't0000000-0000-0000-0000-000000000001', '2026-05-10', 'Alongamento e Equilíbrio');

INSERT INTO registros_frequencia (aula_id, aluno_id, presente, registrado_por) VALUES
  ('au000000-0000-0000-0000-000000000001', 'al000000-0000-0000-0000-000000000001', true,  'c0000000-0000-0000-0000-000000000001'),
  ('au000000-0000-0000-0000-000000000001', 'al000000-0000-0000-0000-000000000002', true,  'c0000000-0000-0000-0000-000000000001'),
  ('au000000-0000-0000-0000-000000000001', 'al000000-0000-0000-0000-000000000003', false, 'c0000000-0000-0000-0000-000000000001'),
  ('au000000-0000-0000-0000-000000000002', 'al000000-0000-0000-0000-000000000001', true,  'c0000000-0000-0000-0000-000000000001'),
  ('au000000-0000-0000-0000-000000000002', 'al000000-0000-0000-0000-000000000002', false, 'c0000000-0000-0000-0000-000000000001'),
  ('au000000-0000-0000-0000-000000000003', 'al000000-0000-0000-0000-000000000001', true,  'c0000000-0000-0000-0000-000000000001');

-- Atividades das aulas
INSERT INTO atividades_aula (aula_id, titulo, descricao, criado_por) VALUES
  ('au000000-0000-0000-0000-000000000001', 'Variações de Barra',
   'Exercícios de barra clássica com pliés, tendus e dégagés. Foco no alinhamento postural.',
   'c0000000-0000-0000-0000-000000000001'),
  ('au000000-0000-0000-0000-000000000002', 'Pliés e Relevés',
   'Sequência de demi-plié e grand-plié nas cinco posições. Introdução ao relevé.',
   'c0000000-0000-0000-0000-000000000001');

-- Cobranças
INSERT INTO cobrancas (matricula_id, referencia_mes, referencia_ano, valor, vencimento, status) VALUES
  ('m0000000-0000-0000-0000-000000000001', 6, 2026, 280.00, '2026-06-05', 'pendente'),
  ('m0000000-0000-0000-0000-000000000001', 5, 2026, 280.00, '2026-05-05', 'pago'),
  ('m0000000-0000-0000-0000-000000000001', 4, 2026, 280.00, '2026-04-05', 'pago'),
  ('m0000000-0000-0000-0000-000000000002', 6, 2026, 280.00, '2026-06-05', 'pendente'),
  ('m0000000-0000-0000-0000-000000000002', 5, 2026, 280.00, '2026-05-05', 'vencido');

-- Registros de ponto de teste (imutáveis)
INSERT INTO registros_ponto (colaborador_id, tipo, registrado_em) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'entrada',          '2026-05-23 08:02:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'inicio_intervalo', '2026-05-23 12:00:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'fim_intervalo',    '2026-05-23 13:01:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'saida',            '2026-05-23 17:05:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'entrada',          '2026-05-22 07:58:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'inicio_intervalo', '2026-05-22 12:00:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'fim_intervalo',    '2026-05-22 13:00:00-03'),
  ('c0000000-0000-0000-0000-000000000001', 'saida',            '2026-05-22 17:00:00-03');

-- Convite de teste
INSERT INTO convites (token, empresa_id, criado_por, role_destino, email_destino, nome_destino, expira_em) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
   'a1b2c3d4-0001-0001-0001-000000000001',
   'u0000000-0000-0000-0000-000000000002',
   'professor',
   'novo.professor@email.com',
   'Novo Professor Teste',
   NOW() + INTERVAL '7 days');

-- Confirmar
SELECT 'Seed concluído com sucesso!' AS status,
  (SELECT count(*) FROM users)          AS users,
  (SELECT count(*) FROM empresas)       AS empresas,
  (SELECT count(*) FROM turmas)         AS turmas,
  (SELECT count(*) FROM alunos)         AS alunos,
  (SELECT count(*) FROM matriculas)     AS matriculas,
  (SELECT count(*) FROM cobrancas)      AS cobrancas,
  (SELECT count(*) FROM registros_ponto)AS registros_ponto;
