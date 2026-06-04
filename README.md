# i9 Smart ERP Educacional — v5.0.8
> Sistema completo de gestão para escolas de dança, robótica e similares.
> Desenvolvido e suportado por **i9 Smart**.

---

## 📁 Estrutura de arquivos

```
erp-educacional/
├── app-v3.html              ← App integrado (todos os portais, 98KB, standalone)
├── app-integrado.html       ← Versão anterior (55KB, referência)
├── backend-test.html        ← Página de teste do backend (health, login, rotas, ações por perfil)
├── schema.sql               ← Banco PostgreSQL — estrutura principal
├── schema-v2-additions.sql  ← Adições v2: PGR, Avaliação, Planos, etc.
├── scripts/provision-test-env.js ← Provisionamento idempotente de dados de teste
├── api-backend.ts           ← API REST principal (Fastify + Prisma)
├── api-routes-v2.ts         ← Rotas v2: PGR, Avaliação, Feedback, Planos
├── prisma-schema.prisma     ← ORM Prisma (todos os modelos tipados)
├── tsconfig.json             ← Build TypeScript para `dist/`
├── .env.example              ← Variáveis de ambiente de exemplo
├── design-system.md         ← Tokens, paletas, componentes por portal
├── deploy-checklist.md      ← Passo a passo de deploy e testes
├── package.json             ← Dependências do projeto
└── README.md                ← Este arquivo
```

---

## 🏗️ Arquitetura do sistema

```
i9 Smart (Suporte)
    └── cria Escolas + gera convites para Gestores
            └── Gestor da escola
                    ├── Professor        → convite + turma vinculada
                    ├── Prof + Colab     → convite + turma + ponto
                    ├── Colaborador      → convite + somente ponto
                    ├── Responsável      → convite + aluno vinculado
                    └── Aluno            → convite + turma vinculada

Cada convite gera um link com instalador do app específico:
  https://app.i9smart.com.br/instalar/{role}?token={UUID}
```

---

## 🔐 Hierarquia de permissões

| Recurso | Suporte | Gestor | Prof+Colab | Colaborador | Responsável | Aluno |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Criar/remover escola | ✅ | — | — | — | — | — |
| Upload logo escola | ✅ | — | — | — | — | — |
| Criar gestor | ✅ | — | — | — | — | — |
| Ver todas as escolas | ✅ | — | — | — | — | — |
| Faturamento da escola | ✅ | ✅ | — | — | — | — |
| Editar salário colaborador | ✅ | ✅ | — | — | — | — |
| Editar dados de aluno | ✅ | ✅ | — | — | — | — |
| Corrigir chamada (auditado) | ✅ | ✅ | — | — | — | — |
| Configurar geofence | ✅ | ✅ | — | — | — | — |
| Criar planos de aula | ✅ | ✅ | — | — | — | — |
| Liberar/bloquear planos | ✅ | ✅ | — | — | — | — |
| Remover usuários | ✅ | ✅* | — | — | — | — |
| Fazer chamada (hold 3s) | ✅ | ✅ | ✅ | — | — | — |
| Ver planos liberados | — | — | ✅ | — | — | — |
| Registrar ponto (hold 3s) | — | — | ✅ | ✅ | — | — |
| Ponto manual (c/ aprovação) | — | — | ✅ | ✅ | — | — |
| PGR Humor (termômetro) | — | — | ✅ | ✅ | — | — |
| PGR Relato confidencial | — | — | ✅ | ✅ | — | — |
| Ver holerites | — | — | ✅ | ✅ | — | — |
| Ver férias | — | — | ✅ | ✅ | — | — |
| Feedback com gestor | — | — | ✅ | ✅ | — | — |
| Dashboard PGR (anônimo) | ✅ | ✅ | — | — | — | — |
| Mensalidade / Pix / Boleto | — | — | — | — | ✅ | — |
| Frequência do filho | — | — | — | — | ✅ | — |
| Marcar pago em dinheiro | ✅ | ✅ | — | — | — | — |
| Avaliar aula (editável) | — | — | — | — | — | ✅ |
| Ver turma e atividades | — | — | — | — | — | ✅ |
| Login c/ senha ou biometria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> *Gestor remove somente usuários da sua própria escola.

---

## 🔒 Regras de negócio críticas

### Ponto digital
- Timestamp capturado **no servidor** — nunca confia no cliente
- Botão hold de **3 segundos** para confirmar (previne acidentes)
- GPS capturado automaticamente via `navigator.geolocation`
- **Geofence**: fora da área os botões ficam desabilitados
- Registro **imutável** — só INSERT, sem UPDATE/DELETE (RLS + trigger)
- Ponto manual: colaborador justifica, gestor aprova
- Ordem validada: não é possível registrar Saída sem Entrada antes

### PGR / NR-1 (Norma Regulamentadora 1)
- Registros **APPEND-ONLY** — trigger no banco bloqueia UPDATE/DELETE
- Nem gestores, nem o suporte técnico podem alterar ou apagar
- Dashboard do gestor: visão agrupada e anônima
- Alerta imediato para RH/gestor em relatos urgentes

### Avaliação de aula
- Aluno avalia com carinhas: 😄 Feliz / 😐 Mais ou menos / 😢 Triste
- **Editável pelo aluno a qualquer momento** (UPSERT)
- Um registro por aula por aluno

### Logo da escola
- **Somente o Suporte** faz upload (JPG/PNG)
- Aparece no cabeçalho de **todos os portais**
- Armazenada no Supabase Storage

### Painel de teste do backend
- `backend-test.html` filtra ações por perfil e mostra só os botões relevantes
- A suíte cobre leitura e escrita principal por papel
- Selecione o perfil antes de rodar para reduzir ruído visual

### Remoção de escola
- Somente o Suporte pode remover
- Escola tem **30 dias para fazer backup** de todos os dados
- Após o prazo: todos os acessos são bloqueados automaticamente

### Notificações de inadimplência
- Vencimento padrão: **dia 5 de cada mês**
- Após **5 dias** do vencimento: notificação automática ao Responsável
- Gestor pode marcar pagamento em dinheiro manualmente

---

## 🚀 Deploy rápido

Ambientes configurados para este projeto:

- GitHub: https://github.com/i9makersm/i9-smart-erp.git
- Netlify: https://i9smart.netlify.app/
- Supabase: https://tofszwegngqzlcfuzjfg.supabase.co

### 1. Banco de dados (Supabase)
```bash
npm run db:bootstrap
```

### 2. Backend
```bash
cp .env.example .env
# Preencher SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

npm install
npx prisma generate
npm run setup
```

### 3. App
```bash
# Abrir app-v3.html diretamente no browser para testes
# Abrir backend-test.html para validar a API sem abrir os portais
# Para produção no Netlify:
npm run build:netlify
```

O Netlify publica a pasta `public/`, gerada automaticamente pelo build.
Defina `I9_API_BASE` e `I9_API_V2_BASE` no Netlify quando a API estiver em uma URL publica.

---

## 👥 Contas de teste (seed)

| E-mail | Perfil | Acesso |
|---|---|---|
| suporte@erp.com | Suporte i9 Smart | Total |
| gestor@arteemmovimento.com | Gestor | Studio Arte em Movimento |
| anapaula@arteemmovimento.com | Professor + Colab | Turmas Ballet |
| carlos@arteemmovimento.com | Colaborador | Somente ponto |
| carla@email.com | Responsável | Sofia Almeida |
| sofia@email.com | Aluno | Ballet Infantil B |

---

## 📡 Endpoints principais

### Auth
```
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Convites (link + instalador do app)
```
POST   /convites
GET    /convites/:token
POST   /convites/:token/aceitar
DELETE /convites/:token
GET    /convites
```

### Ponto (imutável, server-side)
```
POST /ponto/registrar     ← timestamp automático no servidor
GET  /ponto/hoje
GET  /ponto/historico
```

### Turmas e chamada
```
GET  /turmas
POST /turmas
GET  /turmas/:id/alunos
POST /turmas/:id/chamada  ← data/hora automáticos
```

### Planos de aula
```
GET    /planos
POST   /planos
PATCH  /planos/:id/status
DELETE /planos/:id
```

### PGR (NR-1 — APPEND-ONLY)
```
POST /pgr/humor    ← somente INSERT, sem UPDATE/DELETE
POST /pgr/relato   ← conteúdo imutável por lei
GET  /pgr/dashboard
```

### Avaliação de aula
```
POST /avaliacoes/aula/:aula_id  ← UPSERT (aluno edita quando quiser)
GET  /avaliacoes/turma/:turma_id
```

### Financeiro
```
GET  /cobrancas/minhas
GET  /cobrancas/:id/pix
POST /cobrancas/gerar
GET  /financeiro/dashboard
GET  /holerites
```

### Usuários e perfil
```
GET  /colaborador/perfil
PUT  /colaborador/perfil
PUT  /colaborador/:id/perfil
GET  /settings
PUT  /settings
DELETE /usuarios/:id           ← soft delete + revoga Supabase Auth
```

### Notificações
```
GET   /notificacoes
PATCH /notificacoes/:id/lida
```

### Suporte
```
POST /empresas/:id/logo
GET  /contratos/:empresa_id
POST /contratos/:empresa_id/bloquear
POST /cron/verificar-inadimplencia
```

---

## 🛠️ Stack tecnológica

| Camada | Tecnologia |
|---|---|
| App (frontend) | HTML5 + CSS3 + JS (standalone, zero dependências) |
| Backend | Fastify 4 + TypeScript + Zod |
| ORM | Prisma 5 |
| Banco de dados | PostgreSQL 15 (Supabase) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (logos, arquivos) |
| Pagamentos | Pix (Woovi/OpenPix), Boleto |
| Deploy | Vercel (frontend) + Railway (backend) |
| Notificações | Push (Expo / Web Push), E-mail (Resend) |

---

## 📋 Próximos passos

- [ ] Integração real com gateway Pix (Woovi/OpenPix)
- [ ] Push notifications (Expo para mobile / Web Push API)
- [ ] PWA instalável via manifest.json
- [ ] Cron pg_cron para inadimplência diária
- [ ] Relatórios PDF de frequência e financeiro
- [ ] Biometria nativa via WebAuthn API
- [ ] Testes automatizados (Jest + Supertest)
- [ ] CI/CD (GitHub Actions → Railway + Vercel)

---

*powered by i9 Smart · Versão: 5.0.8 (10013073)*
