# 🚀 Features Roadmap — Azure DevOps Analytics Dashboard

> **Validação do Projeto (11/05/2026)**
>
> | Check | Status |
> |---|---|
> | `npm run build` | ✅ Sucesso (287 kB JS, 25 kB CSS) |
> | `npm test -- --run` | ✅ 37 testes passando (3 suites) |
> | `npm run lint` | ✅ Sem erros (warnings apenas) |
> | TypeScript (`strict: true`) | ✅ Configurado |
> | CI/CD (GitHub Actions) | ✅ Setup → Build → Deploy |
> | Dependabot | ✅ Ativo |

---

## Índice

1. [Monte Carlo Forecasting (Simulação)](#1-monte-carlo-forecasting-simulação)
2. [Relatórios Exportáveis (PDF/CSV)](#2-relatórios-exportáveis-pdfcsv)
3. [Alertas Configuráveis e Notificações](#3-alertas-configuráveis-e-notificações)
4. [Dashboard Comparativo entre Sprints](#4-dashboard-comparativo-entre-sprints)
5. [Modo Apresentação / TV Mode](#5-modo-apresentação--tv-mode)
6. [Persistência de Preferências por Query](#6-persistência-de-preferências-por-query)
7. [Scatter Plot de Cycle Time](#7-scatter-plot-de-cycle-time)
8. [SLA Tracking e Service Level Expectations](#8-sla-tracking-e-service-level-expectations)
9. [Multi-Projeto / Cross-Project Analytics](#9-multi-projeto--cross-project-analytics)
10. [Web Worker para Processamento Pesado](#10-web-worker-para-processamento-pesado)
11. [Dependency Graph (Visualização de Dependências)](#11-dependency-graph-visualização-de-dependências)
12. [Filtros Avançados com URL State](#12-filtros-avançados-com-url-state)
13. [Modo Offline com Service Worker](#13-modo-offline-com-service-worker)
14. [Métricas DORA Simplificadas](#14-métricas-dora-simplificadas)
15. [Atalhos de Teclado (Keyboard Shortcuts)](#15-atalhos-de-teclado-keyboard-shortcuts)
16. [Remoção dos `@ts-nocheck` e Tipagem Completa](#16-remoção-dos-ts-nocheck-e-tipagem-completa)

---

## 1. Monte Carlo Forecasting (Simulação)

**Prioridade:** 🔴 Alta  
**Complexidade:** Média  
**Impacto:** Permite previsão probabilística de datas de entrega.

### Descrição
Usar o histórico de Throughput (já calculado em `analytics.ts`) para realizar N simulações (ex: 10.000) de cenários futuros, gerando percentis de probabilidade de conclusão (P50, P85, P95).

### Detalhamento Técnico

- **Dados de entrada:** Array `throughputData` já gerado em `processAnalytics()` (`analytics.ts:143-211`). Cada ponto contém `{ label, range, count }` por semana.
- **Algoritmo:**
  1. Extrair as contagens semanais de throughput: `throughputData.map(d => d.count)`.
  2. Para cada simulação, sortear aleatoriamente (com reposição) semanas do histórico.
  3. Acumular até atingir o número de itens restantes (`kpis.backlog + kpis.inprogress`).
  4. Registrar quantas semanas cada simulação levou.
  5. Ordenar resultados e extrair percentis.
- **Novo módulo:** `src/forecast.ts` com função `runMonteCarloSimulation(throughputHistory: number[], remainingItems: number, simulations?: number)`.
- **Renderização:** Novo chart com `Chart.js` tipo histogram mostrando distribuição de resultados. Adicionar card em `index.html` após o Throughput Chart.
- **i18n:** Adicionar chaves `forecast-title`, `forecast-p50`, `forecast-p85`, `forecast-p95` em `translations.ts`.
- **Testes:** Suite em `src/forecast.test.ts` validando distribuição estatística com seed fixa.

---

## 2. Relatórios Exportáveis (PDF/CSV)

**Prioridade:** 🔴 Alta  
**Complexidade:** Média  
**Impacto:** Permite compartilhar dados com stakeholders que não acessam o dashboard.

### Descrição
Gerar relatórios completos em PDF (com gráficos) e CSV (com dados tabulares) a partir dos dados atuais da query selecionada.

### Detalhamento Técnico

- **CSV:** Serializar `state.currentData.items` (acessível via `state.ts:8`) em formato CSV com colunas: ID, Title, State, Type, AssignedTo, CreatedDate, ClosedDate, LeadTime, CycleTime. Usar `Blob` + `URL.createObjectURL` para download.
- **PDF:** Usar `html2canvas` (já carregado como `window.html2canvas` em `events.ts:193`) para capturar cada seção do dashboard. Combinar snapshots em um PDF via `jsPDF` (nova dependência, ~50 kB gzipped).
- **Watermark:** Reutilizar `drawWatermark()` de `events.ts:8-72` para aplicar logo da empresa em cada página do PDF.
- **Botão de exportação:** Adicionar dropdown no header ao lado do `refresh-btn` com opções "Export PDF" e "Export CSV".
- **i18n:** Chaves `export-pdf`, `export-csv`, `export-generating`.
- **Novo módulo:** `src/export.ts` com funções `exportToCSV(items, language)` e `exportToPDF(elements, watermarkConfig)`.

---

## 3. Alertas Configuráveis e Notificações

**Prioridade:** 🟡 Média  
**Complexidade:** Média  
**Impacto:** Proatividade na detecção de problemas de fluxo.

### Descrição
Permitir que o usuário defina thresholds (ex: "Lead Time > 30 dias", "WIP > 10 em coluna X") e receber alertas visuais no dashboard.

### Detalhamento Técnico

- **Configuração:** Formulário modal para definir regras. Estrutura:
  ```ts
  interface AlertRule {
    id: string;
    metric: 'lead_time_avg' | 'cycle_time_avg' | 'wip_column' | 'aging_max' | 'bottleneck_avg';
    operator: '>' | '<' | '>=';
    threshold: number;
    column?: string; // para WIP e bottleneck
  }
  ```
- **Persistência:** Salvar em `localStorage` sob chave `alert_rules` (sem dados sensíveis, apenas configuração).
- **Avaliação:** Executar verificação no final de `processAnalytics()` (`analytics.ts:237`), após os KPIs serem calculados. Chamar `evaluateAlerts(kpis, alertRules)`.
- **UI:** Toast (`showToast` de `utils.ts:240`) com tipo `warning` para cada regra violada. Badge vermelho nos KPI cards afetados.
- **Novo módulo:** `src/alerts.ts`.

---

## 4. Dashboard Comparativo entre Sprints

**Prioridade:** 🟡 Média  
**Complexidade:** Alta  
**Impacto:** Visualizar tendências e evolução do time ao longo de sprints.

### Descrição
Comparar métricas (Lead Time, Cycle Time, Throughput, WIP) entre duas queries ou períodos diferentes lado a lado.

### Detalhamento Técnico

- **Seleção:** Adicionar segundo `<select>` de query ao lado do `querySelector` (`main.ts:50`). Ao selecionar, carregar dados via `loadQueryData()` em um slot separado do state.
- **State:** Novo campo em `AppState` (`types.ts:110`):
  ```ts
  comparisonData: {
    items: WorkItemNode[];
    tree: WorkItemNode[];
    revisions: Record<number, WorkItem[]>;
  } | null;
  ```
- **Cálculo:** Executar `processAnalytics()` com ambos datasets e produzir métricas delta (Δ Lead Time, Δ Throughput, etc.).
- **Renderização:** Adicionar datasets adicionais nos gráficos Chart.js existentes (ex: `renderCharts` em `charts.ts:9` aceitar segundo par de `leadTimes`/`cycleTimes` com estilo tracejado).
- **KPIs:** Exibir seta ↑/↓ com variação percentual ao lado dos valores atuais.

---

## 5. Modo Apresentação / TV Mode

**Prioridade:** 🟡 Média  
**Complexidade:** Baixa  
**Impacto:** Ideal para radiadores de informação em times ágeis.

### Descrição
Modo fullscreen que exibe os widgets do dashboard em rotação automática, otimizado para TVs de time.

### Detalhamento Técnico

- **Ativação:** Botão no header que chama `document.documentElement.requestFullscreen()`. Adicionar classe CSS `.tv-mode` no body.
- **Rotação:** Timer (`setInterval`) que cicla entre seções do dashboard (KPIs → Charts → Gantt → Heatmap → Progress). Cada slide visível por 15-30s (configurável).
- **CSS:** Em `.tv-mode`: esconder header, tabs, filtros. Maximizar área do conteúdo. Fontes maiores (`font-size: clamp(...)` com valores mais altos).
- **Auto-refresh:** Chamar `handlers.handleRefresh()` (de `main.ts:195`) a cada ciclo completo para manter dados atualizados.
- **Saída:** ESC ou click para sair do fullscreen. `document.addEventListener('fullscreenchange', ...)` para resetar.
- **Impacto nos módulos existentes:** Apenas CSS novo em `style.css` e lógica leve em `events.ts`.

---

## 6. Persistência de Preferências por Query

**Prioridade:** 🟢 Baixa  
**Complexidade:** Baixa  
**Impacto:** UX — lembrar filtros e configurações do último acesso.

### Descrição
Salvar e restaurar filtros ativos (tipos de work item, período do Gantt, status filtrados) associados a cada query selecionada.

### Detalhamento Técnico

- **Estrutura:**
  ```ts
  interface QueryPreferences {
    ganttPeriod: string;
    activeTypes: string[];
    portfolioFilters: string[];
    ganttStatusFilters: Record<string, boolean>;
  }
  ```
- **Storage:** `localStorage.setItem('query_prefs_' + queryId, JSON.stringify(prefs))`.
- **Restauração:** No `handleQueryChange` (`main.ts:190`), após carregar dados, ler prefs e aplicar:
  - `elements.ganttPeriod.value = prefs.ganttPeriod`
  - `state.globalActiveTypes = prefs.activeTypes`
- **Salvamento:** Debounced listener nos filtros que serializa o estado atual a cada mudança.
- **Limpeza:** Botão "Reset Filters" que remove a chave do localStorage.

---

## 7. Scatter Plot de Cycle Time

**Prioridade:** 🟡 Média  
**Complexidade:** Baixa  
**Impacto:** Métrica Kanban essencial para identificar outliers.

### Descrição
Gráfico de dispersão mostrando o Cycle Time individual de cada work item completado ao longo do tempo, com linhas de percentis (P50, P85, P95).

### Detalhamento Técnico

- **Dados:** Reutilizar cálculo existente em `processAnalytics()` (`analytics.ts:60-80`), onde `cycleTimes` e `closedDate` já são extraídos. Criar array `{ x: closedDate, y: cycleTimeDays, id, title }`.
- **Chart:** Tipo `scatter` do Chart.js. Eixo X = data de conclusão, Eixo Y = dias de cycle time.
- **Linhas de percentil:** Usar plugin `annotation` do Chart.js para desenhar linhas horizontais nos percentis.
- **Interação:** Click no ponto abre o work item no Azure DevOps (reuso de `getWorkItemUrl` de `utils.ts:86`).
- **Card:** Adicionar em `index.html` na grid de charts, após o Lead/Cycle Time chart.
- **Responsividade:** Seguir padrão existente com `responsive: true, maintainAspectRatio: false`.

---

## 8. SLA Tracking e Service Level Expectations

**Prioridade:** 🟡 Média  
**Complexidade:** Média  
**Impacto:** Medir cumprimento de acordos de nível de serviço.

### Descrição
Definir metas de SLA por tipo de work item (ex: Bug ≤ 5 dias, Story ≤ 15 dias) e visualizar taxa de cumprimento.

### Detalhamento Técnico

- **Configuração:** Modal com formulário por tipo. Persistir em `localStorage`:
  ```ts
  interface SLAConfig {
    [workItemType: string]: { targetDays: number; metric: 'lead' | 'cycle' };
  }
  ```
- **Cálculo:** No `processAnalytics()`, para cada item concluído, comparar tempo real vs. target. Produzir `{ type, met: number, breached: number, pctMet }`.
- **Renderização:** Donut chart por tipo mostrando % met vs. breached. Cards de KPI com cor semafórica (verde >90%, amarelo >70%, vermelho <70%).
- **Gantt:** Adicionar indicador visual (ícone ⚠️) nos itens do Gantt (`gantt.ts`) cujo tempo está acima do SLA.
- **i18n:** Chaves `sla-title`, `sla-met`, `sla-breached`, `sla-configure`.

---

## 9. Multi-Projeto / Cross-Project Analytics

**Prioridade:** 🟢 Baixa  
**Complexidade:** Alta  
**Impacto:** Visão de portfólio para gestores com múltiplos projetos.

### Descrição
Carregar e agregar métricas de múltiplos projetos Azure DevOps simultaneamente.

### Detalhamento Técnico

- **API:** Usar `fetchProjects()` já existente (`api.ts:433`) para listar projetos disponíveis. Permitir seleção múltipla.
- **Carregamento:** Para cada projeto selecionado, executar `fetchQueries` + `loadQueryData` em paralelo. Necessário parametrizar `config.project` em cada chamada.
- **Agregação:** Unificar os arrays `items` de todos os projetos, adicionando campo `projectName` para diferenciação. Ajustar `buildTree()` para não cruzar hierarquias entre projetos.
- **State:** Novo campo `multiProjectData: Map<string, CurrentData>` em `AppState`.
- **UI:** Selector multi-projeto no header. Charts agregados com opção de drill-down por projeto (usar datasets coloridos por projeto).
- **Cache:** Chaves de cache já são por URL que inclui o projeto, então não há conflito.

---

## 10. Web Worker para Processamento Pesado

**Prioridade:** 🟢 Baixa  
**Complexidade:** Média  
**Impacto:** Evitar travamentos de UI em datasets grandes (>1000 itens).

### Descrição
Mover cálculos intensivos (CFD, Bottleneck, Throughput) para um Web Worker.

### Detalhamento Técnico

- **Módulo:** `src/analytics.worker.ts` usando `self.onmessage` e `self.postMessage`.
- **Candidatos a offload:**
  - Loop de 180 dias do CFD (`analytics.ts:108-131`) — O(180 × N) onde N = itens.
  - `calculateBottlenecks()` (`analytics.ts:250-306`) — itera todas as revisões.
  - Throughput calculation (`analytics.ts:143-211`).
- **Comunicação:** `postMessage({ type: 'cfd', payload: cfdSeries })`. Main thread registra `worker.onmessage` e chama `renderCFDChart()` quando dados chegam.
- **Vite:** Usar `new Worker(new URL('./analytics.worker.ts', import.meta.url), { type: 'module' })` que o Vite resolve automaticamente.
- **Fallback:** Detecção de suporte a Worker. Se indisponível, rodar inline como hoje.
- **Impacto:** Zero breaking changes — apenas a orquestração em `processAnalytics()` muda de síncrona para assíncrona.

---

## 11. Dependency Graph (Visualização de Dependências)

**Prioridade:** 🟢 Baixa  
**Complexidade:** Alta  
**Impacto:** Mapear bloqueios e dependências entre work items.

### Descrição
Gráfico de rede mostrando relações de dependência (Predecessor/Successor) entre work items.

### Detalhamento Técnico

- **Dados:** As `relations` já são carregadas com `$expand=all` na API (`api.ts:118`). Filtrar por `rel === 'System.LinkTypes.Dependency-Forward'` e `System.LinkTypes.Dependency-Reverse'`.
- **Renderização:** Usar D3.js force-directed graph ou Cytoscape.js (nova dependência). Nós coloridos por tipo (usar `getItemIcon().color`), arestas com setas indicando direção.
- **Interação:** Click no nó abre detalhes. Hover mostra tooltip com título e estado. Zoom e pan nativos da lib.
- **Layout:** Nova tab "Dependencies" ou sub-tab dentro de "Items".
- **Performance:** Limitar a itens de nível portfolio/requirement. Para >200 nós, usar clustering.
- **CSS:** Container com `width: 100%; height: 600px; overflow: hidden`.

---

## 12. Filtros Avançados com URL State

**Prioridade:** 🟡 Média  
**Complexidade:** Baixa  
**Impacto:** Compartilhar estados filtrados via URL.

### Descrição
Sincronizar filtros ativos, query selecionada, período do Gantt e tab ativa com os query parameters da URL.

### Detalhamento Técnico

- **Serialização:** `URLSearchParams` com parâmetros:
  - `q` = query ID
  - `tab` = dashboard | items | timeline
  - `period` = week | month | quarter | total
  - `types` = comma-separated active types
  - `theme` = dark | light
  - `lang` = pt-br | en
- **Leitura:** No `initApp()` (`main.ts:75`), ler `window.location.search` e aplicar estado antes de exibir dashboard.
- **Escrita:** `history.replaceState()` (sem navegação) nos handlers: `handleQueryChange`, `handleTabSwitch`, `handleGanttPeriodChange`, filter changes.
- **Compartilhamento:** Botão "Share" que copia a URL atual para clipboard via `navigator.clipboard.writeText()`.
- **Sem breaking changes:** Se URL não tem params, comportamento padrão (localStorage).

---

## 13. Modo Offline com Service Worker

**Prioridade:** 🟢 Baixa  
**Complexidade:** Média  
**Impacto:** Permitir uso do dashboard sem internet (com dados cacheados).

### Descrição
Registrar Service Worker para cache dos assets estáticos e, opcionalmente, dos dados da API já carregados.

### Detalhamento Técnico

- **Strategy:** Cache-first para assets estáticos (JS, CSS, HTML, SVG). Network-first para API calls com fallback para cache.
- **Arquivo:** `public/sw.js` com lifecycle events `install`, `activate`, `fetch`.
- **Registro:** Em `main.ts`, após `initApp()`:
  ```ts
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
  ```
- **Cache de dados:** Interceptar requests para `dev.azure.com` e armazenar no `CacheStorage` do browser. Complementar ao `apiCache` in-memory (`cache.ts`).
- **Indicador:** Badge "Offline" no header quando `!navigator.onLine`. Usar `window.addEventListener('online'/'offline', ...)`.
- **Vite config:** Adicionar `public/sw.js` como asset estático (já funciona com a pasta `public/`).

---

## 14. Métricas DORA Simplificadas

**Prioridade:** 🟡 Média  
**Complexidade:** Média  
**Impacto:** Métricas de engenharia reconhecidas pela indústria.

### Descrição
Calcular versões simplificadas das 4 métricas DORA usando dados de work items: Deployment Frequency (throughput), Lead Time for Changes, Change Failure Rate, e Time to Restore.

### Detalhamento Técnico

- **Deployment Frequency:** Já existe como Throughput chart. Adicionar média semanal e classificação (Elite/High/Medium/Low).
- **Lead Time for Changes:** Calcular a partir dos `leadTimes` já existentes (`analytics.ts:77`). Média dos últimos 30 dias.
- **Change Failure Rate:** Proporção de Bugs criados vs. total de itens concluídos no período. Requer filtro por tipo (`bug` via `getItemIcon`).
- **Time to Restore:** Lead Time médio apenas de Bugs. Filtro: `type === 'bug' && closedDate !== null`.
- **Renderização:** Seção dedicada com 4 cards estilo "scorecard" com classificação por cores (Elite=verde, High=azul, Medium=amarelo, Low=vermelho).
- **Novo módulo:** `src/dora.ts` com `calculateDORAMetrics(items, workItemMetadata)`.
- **i18n:** Chaves para cada métrica e classificação.

---

## 15. Atalhos de Teclado (Keyboard Shortcuts)

**Prioridade:** 🟢 Baixa  
**Complexidade:** Baixa  
**Impacto:** Power users — navegação rápida.

### Descrição
Atalhos de teclado para ações frequentes: trocar tabs, refresh, trocar tema, trocar idioma.

### Detalhamento Técnico

- **Listener:** `document.addEventListener('keydown', handler)` em `events.ts`.
- **Mapa de atalhos:**
  | Atalho | Ação | Handler existente |
  |---|---|---|
  | `1-4` | Trocar tab (Dashboard/Items/Timeline/Setup) | `handleTabSwitch()` |
  | `R` | Refresh dados | `handleRefresh()` |
  | `T` | Toggle tema | `handleThemeToggle()` |
  | `L` | Toggle idioma | `handleLangToggle()` |
  | `?` | Mostrar modal de ajuda | Novo |
- **Guarda:** Ignorar quando `document.activeElement` é `input`, `select`, ou `textarea` (evitar conflitos com formulários).
- **Modal de ajuda:** Overlay simples com tabela de atalhos. Aberto via `?` ou botão no header.
- **i18n:** Chave `shortcuts-title`, `shortcuts-help`.

---

## 16. Remoção dos `@ts-nocheck` e Tipagem Completa

**Prioridade:** 🔴 Alta  
**Complexidade:** Média  
**Impacto:** Qualidade de código, detecção de bugs em tempo de compilação.

### Descrição
Remover as diretivas `// @ts-nocheck` dos arquivos `analytics.ts`, `charts.ts`, `events.ts` e `ui.ts`, adicionando tipagem explícita a todas as funções e parâmetros.

### Detalhamento Técnico

- **Arquivos afetados:**
  - `src/analytics.ts` (linha 1) — `processAnalytics()` e `calculateBottlenecks()` precisam de assinaturas tipadas.
  - `src/charts.ts` (linha 1) — Todas as funções `render*` precisam de interfaces para seus parâmetros.
  - `src/events.ts` (linha 1) — `initEvents()` e `drawWatermark()` precisam de tipos para `elements` e `handlers`.
  - `src/ui.ts` (linha 1) — `switchTab()`, `applyTranslations()`, `populateQueries()`.
- **Interfaces necessárias:** Criar em `types.ts`:
  ```ts
  interface AnalyticsOptions {
    currentTheme: 'dark' | 'light';
    currentLanguage: string;
    workItemMetadata: WorkItemMetadata;
    charts: ChartInstances;
    azureConfig: AzureConfig;
    progressList: HTMLElement;
    revisionsData?: Record<number, WorkItem[]>;
    callRenderGantt?: () => void;
  }
  
  interface EventHandlers {
    handleTabSwitch: (tabId: string) => void;
    handleAuth: (e: Event) => Promise<void>;
    // ... etc
  }
  ```
- **Abordagem:** Arquivo por arquivo, incremental. Cada PR remove um `@ts-nocheck`.
- **Validação:** `npx tsc --noEmit` deve passar sem erros após cada remoção.

---

## Matriz de Priorização

| Feature | Prioridade | Complexidade | Dependências |
|---|---|---|---|
| Monte Carlo Forecasting | 🔴 Alta | Média | Throughput data |
| Relatórios PDF/CSV | 🔴 Alta | Média | html2canvas (já presente) |
| Remoção `@ts-nocheck` | 🔴 Alta | Média | Nenhuma |
| Scatter Plot Cycle Time | 🟡 Média | Baixa | Chart.js annotation plugin |
| Alertas Configuráveis | 🟡 Média | Média | Nenhuma |
| URL State Filters | 🟡 Média | Baixa | Nenhuma |
| DORA Metrics | 🟡 Média | Média | Nenhuma |
| SLA Tracking | 🟡 Média | Média | Nenhuma |
| Sprint Comparativo | 🟡 Média | Alta | Multi-query state |
| TV Mode | 🟡 Média | Baixa | Fullscreen API |
| Keyboard Shortcuts | 🟢 Baixa | Baixa | Nenhuma |
| Query Preferences | 🟢 Baixa | Baixa | localStorage |
| Web Worker | 🟢 Baixa | Média | Worker API |
| Multi-Projeto | 🟢 Baixa | Alta | fetchProjects() |
| Dependency Graph | 🟢 Baixa | Alta | D3.js ou Cytoscape |
| Modo Offline | 🟢 Baixa | Média | Service Worker API |
