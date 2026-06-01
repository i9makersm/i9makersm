# i9 Smart ERP — Design System v2.0

## Identidade visual da plataforma

### Empresa suporte: i9 Smart
- Cor principal: `#004077` (azul marinho profundo)
- Logo: logotipo "i9" em branco sobre fundo `#004077`
- Gradiente do header: `linear-gradient(135deg, #003060, #004077)`

---

## Paletas por portal

| Portal | Gradiente do header | Acento |
|---|---|---|
| **Suporte (i9 Smart)** | `#003060 → #004077` | `#93c5fd` |
| **Gestor** | `#1e1b4b → #312e81` | `#c7d2fe` |
| **Professor + Colab** | `#085041 → #0f6e56` | `#a7f3d0` |
| **Colaborador** | `#4338ca → #6d28d9` | `#93c5fd` |
| **Responsável** | `#0369a1 → #0c4a6e` | `#bfdbfe` |
| **Aluno** | `#854f0b → #92400e` | `#fde68a` |

---

## Tokens globais

```css
:root {
  /* Cores semânticas */
  --purple:   #7c3aed;   --purple-l: #f5f3ff;
  --green:    #16a34a;   --green-l:  #f0fdf4;   --green-b:  #bbf7d0;
  --red:      #ef4444;   --red-l:    #fef2f2;   --red-b:    #fca5a5;
  --amber:    #d97706;   --amber-l:  #fffbeb;   --amber-b:  #fde68a;
  --blue:     #0369a1;   --blue-l:   #eff6ff;   --blue-b:   #bfdbfe;
  --teal:     #0f6e56;   --teal-l:   #e1f5ee;
  --i9:       #004077;   /* i9 Smart brand */

  /* Layout */
  --bg:       #f0efff;   /* fundo geral */
  --card:     #ffffff;   /* fundo de cards */
  --bdr:      rgba(0,0,0,0.08);
  --tx:       #111827;   /* texto principal */
  --tx2:      #6b7280;   /* texto secundário */
  --tx3:      #9ca3af;   /* texto terciário */

  /* Raios */
  --r:   15px;   /* cards, modais */
  --rsm: 10px;   /* botões, inputs */
}
```

---

## Componentes principais

### HoldButton (3 segundos)
Usado no registro de ponto e chamada de presença.

```css
.hold {
  position: relative; overflow: hidden;
  border-radius: 13px; border: 1.5px solid var(--cor);
  height: 74px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer; user-select: none;
}
/* Barra de progresso interna */
.hold .hf {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 0%; border-radius: 11px; transition: none;
}
```

**Comportamento:**
1. Usuário pressiona e mantém por 3 segundos
2. Barra de progresso preenche da esquerda para direita
3. Ao completar: fundo muda para cor do botão, ícone vira ✅
4. Timestamp capturado **no servidor** (não no cliente)
5. GPS capturado via `navigator.geolocation`

### FloatCard
Card flutuante que sobrepõe o header (margem negativa).

```css
.fc-wrap {
  background: #fff;
  border-radius: 15px;
  padding: 15px 17px;
  box-shadow: 0 8px 30px rgba(0,0,0,.13);
  margin: -20px 13px 0;  /* sobrepõe o header */
  position: relative;
  z-index: 10;
}
```

### Settings List Item
Altura mínima de 52px para acessibilidade em touch.

```css
.set-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 0;
  border-bottom: 0.5px solid var(--bdr);
  cursor: pointer; min-height: 52px;
  transition: background 0.1s;
}
```

### Toggle Switch

```css
.sw-tog { width: 38px; height: 21px; border-radius: 20px; }
.sw-tog.on { background: var(--purple); }
.sw-tog::after { /* bolinha branca */ width: 15px; height: 15px; }
.sw-tog.on::after { transform: translateX(17px); }
```

### Modal Bottom Sheet

```css
.mbg { position: absolute; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; }
.mbox { background: #fff; border-radius: 20px 20px 0 0; max-height: 90%; overflow-y: auto; }
```

---

## Humor / PGR (Termômetro emocional)

```
😄 Excelente  → verde   (#22c55e)
🙂 Bem        → azul    (#3b82f6)
😐 Neutro     → amarelo (#eab308)
😟 Estressado → laranja (#f97316)
😡 Mal        → vermelho (#ef4444)
```

## Avaliação de aula (Aluno)

```
😄 Feliz        → verde   (sel-feliz)
😐 Mais ou menos → âmbar (sel-mmm)
😢 Triste       → vermelho (sel-triste)
```

---

## Bottom Navigation

- 4–5 itens por role
- Ícone ativo: roxo (`--purple`)
- Fundo ativo: roxo claro (`--purple-l`)
- Fonte: 9px, peso 600
- Altura total: 68px com padding-bottom: 10px (safe area)

---

## Hierarquia de visibilidade de menus

```
Suporte  → Escolas, Convites, Turmas, Config (logo, geo, salário, remover)
Gestor   → Dashboard, Turmas, Financeiro, Planos, Acessos
Prof+Co  → Turmas, Chamada, Planos (só liberados), Ponto
Colab    → Ponto, Histórico, Perfil, Config
Respons. → Frequência, Mensalidades, Dados, Config
Aluno    → Minha turma, Frequência, Atividades, Config
```

**Regra absoluta:** nenhum perfil vê o nome dos perfis acima de si na hierarquia.

---

## Tipografia

```css
/* Títulos de card */
font-size: 13px; font-weight: 700; color: var(--tx);

/* Texto primário */
font-size: 12–14px; font-weight: 400–600; color: var(--tx);

/* Labels, metadados */
font-size: 10–11px; font-weight: 400–500; color: var(--tx2);

/* Badges, pills */
font-size: 9–10px; font-weight: 600;

/* KPIs no header */
font-size: 13px; font-weight: 700; color: rgba(255,255,255,1);
```

---

## Pills (badges de status)

```css
.p-ok   { background: #f0fdf4; color: #16a34a; }  /* Ativa, Aceito, Completo */
.p-err  { background: #fef2f2; color: #ef4444; }  /* Erro, Bloqueado, Falta */
.p-warn { background: #fffbeb; color: #d97706; }  /* Pendente, Atenção */
.p-info { background: #eff6ff; color: #0369a1; }  /* Informativo */
.p-neu  { background: #f3f4f6; color: #6b7280; }  /* Neutro, Expirado */
.p-pur  { background: #f5f3ff; color: #7c3aed; }  /* Novo, Destaque */
```

---

## Acessibilidade

- Todos os botões de ação têm `aria-label`
- Altura mínima de 48px em elementos interativos (touch target)
- Contraste mínimo 4.5:1 para textos sobre fundos coloridos
- HoldButton tem feedback visual progressivo (barra de progresso)
- Modais fecham ao clicar no backdrop
- Botão Voltar disponível para Suporte, Gestor e Professor

---

*powered by i9 Smart · v5.0.8*
