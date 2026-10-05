# DESIGN.md — Diniz Contabilidade

Sistema visual do Gerenciador Diniz: **cores da marca Diniz** (azul-marinho + dourado do logo)
com o **padrão de layout dos produtos Diniz** — sidebar escura com item ativo em pílula, topbar com
busca e chips de status, cards de indicador com ação, chips de filtro com contador e tabelas com
cabeçalho em faixa e paginação. A base técnica (tokens, densidade, pílulas, números tabulares) veio
do DESIGN.md "Stripe" da coleção [awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design),
sem o roxo nem o gradient mesh.

Tokens e classes vivem em [`src/styles.css`](src/styles.css). Componentes usam essas classes
globais e mantêm o CSS próprio pequeno (só layout específico da tela, **< 8 kB** — budget de produção).

---

## 1. Atmosfera

- Página clara e fria (`--canvas-soft #f5f7fb`), cards brancos com borda fina e sombra mínima.
  Texto em navy (`--ink #111a35`), nunca preto puro.
- Shell: sidebar navy quase preta (`--navy-900 → --navy-950`), logo grande centralizado, seções em
  caixa-alta e **item ativo = pílula dourada com texto navy**. Sem usuário no rodapé da sidebar (ele
  fica no menu da topbar).
- **Azul-marinho** (`--primary #1a2d7a`) é a cor de ação: botão primário, links, chip ativo, página
  ativa da paginação. **Um botão primário por área.**
- **Dourado** (`--accent #c9a961`) é destaque de marca: item ativo do menu, detalhes decorativos,
  `.icon-tile.accent`. Texto dourado só com `--accent-fg`.
- O dashboard abre com um **banner** de alertas (`.banner`); o resto são cards e tabelas.

## 2. Cores e contraste (WCAG)

| Papel | Token | Observação |
|---|---|---|
| Ação | `--primary` / `-hover` / `-press` | branco sobre primary ≈ 12:1 |
| Fundo de destaque | `--primary-50` / `-100` / `-200` | linha selecionada, avatar, bordas |
| Acento | `--accent` (preenchimento), `--accent-fg` (texto), `--accent-bg`, `--accent-200` | navy sobre dourado ≈ 8:1 · accent-fg sobre branco ≈ 6:1 |
| Texto | `--ink`, `--ink-2`, `--ink-mute` (5.6:1), `--ink-faint` (só placeholder/ícone) | |
| Superfície | `--canvas`, `--canvas-soft`, `--canvas-sunken`, `--canvas-band` | |
| Borda | `--hairline`, `--hairline-strong`, `--hairline-input` | |
| Semânticas | `--success / --warning / --danger / --info` + `-fg` (texto) + `-bg` (fundo) + `-200` (borda) | fg sobre bg ≥ 4.8:1 |
| Neutro | `--neutral-fg`, `--neutral-bg` | |
| Shell | `--navy-900`, `--navy-950` | sidebar, toasts |

Status → cor (sempre igual): `ENTREGUE` → success · `PENDENTE` → warning · `VENCIDO/VENCIDA` → danger ·
`ARQUIVADO` → neutral. Prazo: vencido ou ≤ 1 dia → danger · ≤ 7 dias → warning · > 7 → success
(pipe `prazoTom`). Um PENDENTE com data passada é atraso (danger).

**Nunca**: texto branco sobre dourado; dourado claro como texto em fundo branco; hex soltos nos
componentes; gradient mesh ou roxo/ruby/magenta (removidos).

## 3. Tipografia

Inter, corpo 14px. Títulos em peso 600 com tracking levemente negativo.

| Classe | Tamanho/peso | Uso |
|---|---|---|
| `.page-title` | 24 / 600 | Título da página |
| `.kpi-value` | 30 / 600 tabular | Número do card de indicador |
| `.card-title` | 15 / 600 | Título de card/seção |
| `.kpi-label`, `th`, `.eyebrow` | 11 / 600 CAIXA-ALTA, tracking .07–.1em | Rótulos |
| corpo | 14 / 400 | Texto padrão |
| `.text-sm` / `.caption` | 13 | Apoio |

Números tabulares (`.tnum`) em contagens, datas de tabela, CNPJ/CPF e tamanhos.

## 4. Componentes (classes globais)

**Página**: `.page` › `.page-header` › `.page-header-text` (`.eyebrow`, `.page-title`, `.page-subtitle`)
+ `.page-actions` (primário por último, à direita). `.breadcrumb` quando houver hierarquia.
`.section-label` acima de blocos (`h2` à esquerda, `span` com total à direita).

**Botões** (pílula): `.btn` + `.btn-primary | -secondary | -outline | -ghost | -dark | -danger |
-danger-ghost | -success | -accent | -white | -ghost-light`; tamanhos `.btn-sm | .btn-lg`; `.btn-block`.
Ícone-só: `.btn-icon` (+ `.sm`, `.bordered`, `.danger`, `.active`).

**Formulários**: `.field` › `.field-label` (`<span class="req">*</span>`), `.input | .select | .textarea`
(`.is-invalid`), `.field-hint`, `.field-error`. Grid `.form-grid` (2 col, `.span-2`), `.form-grid-3`.
Seções `.form-section` + `.form-section-title/-desc`. Busca: `.input-icon.search` com
`<app-icon name="search">` + `.input`. `.check`, `.switch`.

**Cards**: `.card` (+ `.card-pad`), `.card-header` (`.plain` sem borda; `.card-title`, `.card-subtitle`),
`.card-body`, `.card-footer`, `.card-interactive`, `.card-dark`.

**Card de indicador (KPI)**: `.kpi` › `.kpi-head` (`.kpi-label` caixa-alta à esquerda + `.icon-tile`
à direita) › `.kpi-main` (`.kpi-value` + pílulas `.badge.badge-soft.badge-*`, ex. "Urgente",
"Venceu há 19 dias", "Sob controle") › `.kpi-foot` (texto curto à esquerda + `.kpi-link` "Resolver →").
Variações: `.is-urgent` (fundo/borda de perigo), `.is-danger | -warning | -success` (cor do número).
`<button class="kpi">` funciona como filtro (`.active` = selecionado).

**Filtros**: `.filter-card` (card branco) com `.input-icon.search` à esquerda e `.filter-chips` à direita.
Chips: `.chip` + `.count`; cor por categoria `.chip-success | -warning | -danger | -info | -accent`;
selecionado `.chip.active` (navy cheio). `.segmented` para alternar visualização. `.toolbar` para
linhas simples de filtros.

**Tabela** (cabeçalho em faixa cinza, rótulos em caixa-alta): `.card.table-card` › `.table-wrap` ›
`table.table` (`.table-compact`). Células: `.cell-main`, `.cell-sub`, `.cell-entity` (avatar + textos),
`.num`, `.col-actions` › `.row-actions` com `.btn-icon.sm.bordered`. `tr.clickable`, `tr.selected`.

**Paginação**: `.table-footer` › "Mostrando **1** a **10** de **N** itens" + `.table-footer-right` ›
`.rows-per-page` ("Linhas por página" + `.select`) e `.pagination` › `button.page-btn.nav` (‹ ›) e
`button.page-btn` (`.active`). Paginação no cliente para listas longas.

**Status**: `.badge` + `-success | -warning | -danger | -neutral | -info | -primary | -accent | -dark |
-outline`, `.badge-dot` (bolinha), `.badge-soft` (pílula com borda). `.tag` (categoria/extensão),
`.count` (`.count-danger`, `.count-primary`).

**Identidade**: `.avatar` (`-sm | -lg | -xl`, `.avatar-square`, cores `.c1`–`.c6` via pipe `avatarCor`),
`.icon-tile` (`.success | .warning | .danger | .info | .accent | .neutral`, `.sm | .lg`).

**Navegação interna**: `.tabs` › `button.tab` (`.active`, com `.count`).

**Feedback**: `.alert` + `-danger | -warning | -success | -info`; `.empty` › `.empty-icon`, `.empty-title`,
`.empty-text`, `.btn`; `.loading-block` + `.spinner`; `.skeleton` (`.skeleton-line`);
`.progress` › `<span style="width:%">` (`.success | .warning | .danger`). `.footnote` (nota com ícone).

**Sobreposição**: `.modal-backdrop` › `.modal` (`-sm | -lg | -xl | -full`) › `.modal-header`
(`.modal-title`, `.modal-subtitle`, `.btn-icon` fechar), `.modal-body`, `.modal-footer`.
Painel lateral: `.drawer-backdrop` + `.drawer` (`.drawer-lg`). Menu: `.menu` › `.menu-item` (`.danger`),
`.menu-sep`, `.menu-label` (posicionado `absolute` num pai relativo).

**Banner**: `.banner` (`.is-danger | .is-success`) › `.banner-art` (ilustração em fundo creme) +
`.banner-body` (`.banner-eyebrow`, `.banner-title`, `.banner-text`, `.banner-actions` com `.btn-white`)
+ `.banner-corner`.

**Outros**: `dl.dl` (dt/dd), `.list` › `.list-item` (`-body`, `-title`, `-sub`), `.date-chip`
(dia/mês, `.tone-danger | -warning | -success`), `.timeline` › `.tl-item` (`.tl-icon.tone-*`, `.tl-body`,
`.tl-text`, `.tl-detail`, `.tl-time`), `.stat-strip` › `.stat` (`.stat-label`, `.stat-value`), `.kbd`, `.dot`.

## 5. Serviços e utilitários compartilhados

- `<app-icon name="folder" [size]="18" />` — `src/app/shared/icon.component.ts`. Não cole SVG inline;
  adicione ícones lá.
- `ToastService` (`shared/ui/toast.service.ts`): `success | error | warning | info(titulo, msg?)`.
  Nunca `alert()`.
- `ConfirmService` (`shared/ui/confirm.service.ts`):
  `if (!(await this.confirm.ask({ titulo, mensagem, confirmar: 'Excluir', tom: 'danger' }))) return;`
  Nunca `window.confirm()`.
- Pipes (`src/app/pipes/formatos.pipe.ts`): `telefone`, `documento` (CNPJ/CPF), `bytes`, `prazo`,
  `prazoTom`, `iniciais`, `avatarCor`. Datas: `| date:'dd/MM/yyyy'` (locale pt-BR registrado).
  Pipes não podem ser usados dentro de event bindings `(click)` — formate no TS.

## 6. Layout e responsividade

- Shell: sidebar fixa 264px (recolhível a 76px pelo botão redondo na borda) + topbar sticky 68px com
  busca (atalhos `/` e `Ctrl+K`), chips de status, calendário, notificações e menu do usuário.
  Conteúdo em `.page` (máx. 1600px, padding 32px).
- Espaçamento base 8: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (`--sp-*`).
- Raio: input 6px, card 14px, modal 18px; botões, chips e itens de menu em pílula.
- Breakpoints: ≤ 1280 cards de indicador 2 por linha; ≤ 1024 sidebar vira gaveta; ≤ 720 uma coluna.
- Alvos de toque ≥ 36px; inputs 38px (44px no login).

## 7. Faça / Não faça

**Faça**
- Mostre primeiro o que exige ação (vencidos, pendências) e ofereça a ação ali mesmo ("Resolver →").
- Trate os 4 estados: carregando (skeleton), vazio (`.empty` com CTA), erro (toast), sucesso (toast).
- Formate para humanos: datas `dd/MM/yyyy`, telefone, CNPJ, tamanhos, prazos relativos.
- Confirme ações destrutivas com `ConfirmService` (`tom: 'danger'`).

**Não faça**
- Mais de um `.btn-primary` por área visível.
- Cores fora dos tokens, gradient mesh, roxo/ruby/magenta.
- Remover funcionalidades ao redesenhar.
