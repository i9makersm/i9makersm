# i9 Smart ERP — Checklist de Deploy e Teste

## ─── PASSO 1: Supabase (banco de dados) ─────────────────────────────────────

1. Use o projeto Supabase: https://tofszwegngqzlcfuzjfg.supabase.co
2. Copie: **Project URL** e **service_role key**
3. Preencha o `.env`
4. Rode:

```bash
npm run setup
```

5. Verifique no painel: **Table Editor** deve mostrar as tabelas principais e os dados de teste provisionados

---

## ─── PASSO 2: Variáveis de ambiente ─────────────────────────────────────────

```bash
cp .env.example .env
```

Edite `.env`:
```env
SUPABASE_URL=https://tofszwegngqzlcfuzjfg.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SERVICE_ROLE_KEY=eyJ... # alias opcional para compatibilidade
DATABASE_URL=postgresql://postgres:SENHA@db.tofszwegngqzlcfuzjfg.supabase.co:5432/postgres
PORT=4000
NODE_ENV=production

# Usado apenas no build do Netlify, quando a API estiver hospedada publicamente.
I9_API_BASE=https://sua-api.example.com
I9_API_V2_BASE=https://sua-api-v2.example.com
```

---

## ─── PASSO 3: Backend ────────────────────────────────────────────────────────

```bash
npm install
npx prisma generate
npm run db:bootstrap      # sincroniza modelos e provisiona o ambiente de teste
npm run build              # compila TS para dist/

# Desenvolvimento
npm run dev               # inicia os dois servidores da API

# Verificar saúde
curl http://localhost:4000/health
# Esperado: {"status":"ok","version":"5.0.8"}
```

---

## ─── PASSO 4: Testes dos endpoints ──────────────────────────────────────────

### Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gestor@arteemmovimento.com","password":"Gestor@2026"}'
# Guarde o access_token retornado como $TOKEN
```

### Registrar ponto (timestamp automático no servidor)
```bash
curl -X POST http://localhost:4000/ponto/registrar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"entrada","latitude":-29.6868,"longitude":-53.8011}'
```

### Fazer chamada (data/hora automáticos — professor não informa)
```bash
curl -X POST "http://localhost:4000/turmas/t0000000-0000-0000-0000-000000000001/chamada" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topico": "Variações de Barra",
    "registros": [
      {"aluno_id": "al000000-0000-0000-0000-000000000001", "presente": true},
      {"aluno_id": "al000000-0000-0000-0000-000000000002", "presente": false}
    ]
  }'
```

### Gerar convite com link instalador
```bash
curl -X POST http://localhost:4000/convites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role_destino": "professor",
    "email_destino": "novo@email.com",
    "nome_destino": "Novo Professor",
    "metadata": {"turma_id": "t0000000-0000-0000-0000-000000000001"}
  }'
# Retorna: {"link": "https://app.i9smart.com.br/instalar/professor?token=UUID"}
```

### PGR — Registro de humor (APPEND-ONLY)
```bash
curl -X POST http://localhost:4001/pgr/humor \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"humor":"bem","quer_contato":false,"anonimo":false}'
```

### Avaliação de aula pelo aluno (UPSERT — editável)
```bash
curl -X POST "http://localhost:4001/avaliacoes/aula/au000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avaliacao":"feliz","comentario":"Aula ótima!"}'
```

### Notificar inadimplência (cron manual)
```bash
curl -X POST http://localhost:4001/cron/verificar-inadimplencia \
  -H "Authorization: Bearer $TOKEN_SUPORTE"
```

---

## ─── PASSO 5: App (frontend standalone) ─────────────────────────────────────

```bash
# Testar localmente — abrir no browser
open app-v3.html

# Produção — Netlify conectado ao GitHub
git remote add origin https://github.com/i9makersm/i9-smart-erp.git
git push -u origin main

# No Netlify, usar:
# Site: https://i9smart.netlify.app/
# Build command: npm run build:netlify
# Publish directory: public
```

O arquivo `netlify.toml` ja define essas configuracoes. Para o frontend acessar uma API
publica, defina `I9_API_BASE` e `I9_API_V2_BASE` nas variaveis de ambiente do Netlify.

**Seletor de portais (demo):** canto superior esquerdo da tela.
Em produção, cada perfil recebe seu próprio link de convite com o app instalador.

**Painel de diagnóstico:** abra `backend-test.html` para validar login, health e rotas por perfil sem depender dos portais.

---

## ─── PASSO 6: Criar senhas no Supabase Auth ─────────────────────────────────

1. Acesse o painel: **Authentication → Users**
2. Para cada e-mail do seed, clique em **Send password reset**
   ou use a API Admin:

```bash
# Criar senha para o gestor de teste
curl -X PUT "https://tofszwegngqzlcfuzjfg.supabase.co/auth/v1/admin/users/USER_UUID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password": "Gestor@2026"}'
```

---

## ─── PASSO 7: Configurar pg_cron (Supabase) ─────────────────────────────────

```sql
-- No SQL Editor do Supabase (requer extensão pg_cron):
SELECT cron.schedule(
  'verificar-inadimplencia-diaria',
  '0 8 * * *',  -- Todo dia às 8h
  'SELECT fn_verificar_inadimplencia()'
);
```

---

## ─── Contas de teste (seed) ─────────────────────────────────────────────────

| E-mail | Perfil | Senha sugerida |
|---|---|---|
| suporte@erp.com | Suporte i9 Smart | Suporte@2026 |
| gestor@arteemmovimento.com | Gestor | Gestor@2026 |
| anapaula@arteemmovimento.com | Prof + Colab | Prof@2026 |
| carlos@arteemmovimento.com | Colaborador | Colab@2026 |
| carla@email.com | Responsável | Resp@2026 |
| sofia@email.com | Aluno | Aluno@2026 |

---

## ─── Checklist de validação ─────────────────────────────────────────────────

### Hierarquia de acesso
- [ ] Suporte vê todas as escolas
- [ ] Gestor vê somente sua escola
- [ ] Professor vê somente suas turmas e planos liberados
- [ ] Colaborador vê somente ponto, histórico, perfil, settings
- [ ] Responsável vê somente dados do seu filho
- [ ] Aluno vê somente turma e atividades

### Ponto digital
- [ ] Timestamp vem do servidor (não do cliente)
- [ ] Hold 3s funciona no mouse e touch
- [ ] Fora do geofence: botões desabilitados
- [ ] Ponto manual vai para aprovação do gestor
- [ ] Registro não pode ser deletado (testar DELETE — deve falhar)

### PGR / NR-1
- [ ] POST /pgr/humor retorna 201
- [ ] DELETE em pgr_emotional_logs falha com erro do trigger
- [ ] Dashboard do gestor mostra dados anônimos
- [ ] Relato urgente gera notificação para gestor

### Planos de aula
- [ ] Gestor cria plano com status "bloqueado"
- [ ] Professor não vê planos bloqueados
- [ ] Gestor publica → professor vê
- [ ] Aluno vê atividades das aulas publicadas

### Financeiro
- [ ] Pix Copia e Cola gerado corretamente
- [ ] Responsável recebe notificação após 5 dias de atraso
- [ ] Gestor marca pago em dinheiro → status atualiza

### Logo
- [ ] Suporte faz upload (JPG/PNG)
- [ ] Logo aparece no header de todos os portais
- [ ] Outros perfis não têm a opção de upload

### Remoção
- [ ] Gestor remove usuário → acesso bloqueado imediatamente
- [ ] Somente suporte remove escola
- [ ] Escola removida tem 30 dias para BKP

---

*powered by i9 Smart · Versão: 5.0.8 (10013073)*
