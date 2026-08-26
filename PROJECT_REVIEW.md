# 🔍 Project Review — Azure DevOps Analytics Dashboard

> Análise crítica do estado atual do código, inconsistências encontradas e sugestões de novas features.

---

## 🚨 O que não faz sentido / Problemas encontrados

### 1. Salt de criptografia hardcoded com mensagem interna (`utils.ts`)

```ts
// "Gemini Ai Rocks!" — isso não deveria estar em código de produção
const SALT = new Uint8Array([71, 101, 109, 105, 110, 105, 32, 65, 105, 32, 82, 111, 99, 107, 115, 33]);
```

**Problema:** O SALT da derivação de chave é estático e hardcoded. Em criptografia, um salt fixo elimina a proteção contra ataques de tabela arco-íris. Deveria ser gerado aleatoriamente e armazenado junto com o IV.

**Impacto:** Dois usuários com a mesma senha produzem a mesma chave de criptografia — vulnerabilidade real.

---

### 2. `ganttOffset` compartilhado entre Gantt e Timeline (`main.ts`)

```ts
handleTimelineNav: (dir: number) => {
    state.ganttOffset += dir;  // ← mesmo campo usado pelo Gantt!
    callRenderTimeline();
}
```

**Problema:** O estado `ganttOffset` em `state.ts` é compartilhado entre o Gantt do dashboard e o Gantt do Timeline. Navegar em um afeta o estado do outro. O campo deveria ser `timelineOffset` separado.

---

### 3. `any` em excesso nos tipos (`analytics.ts`, `api.ts`)

```ts
export interface ComputedMetrics {
    agingData: any[];
    cfdSeries: any[];
    throughputData: any[];
    bottleneckData: any[] | null;
}
```

**Problema:** O projeto usa TypeScript, mas boa parte das interfaces centrais recaem em `any[]`. Isso anula os benefícios do TypeScript. Todos esses tipos já estão implicitamente definidos pelo código que os produz — faltou apenas formalizá-los.

---

### 4. Lógica duplicada de throughput (`analytics.ts`)

O filtro `['user story', 'product backlog item', 'requirement', 'issue']` aparece **duas vezes** no mesmo arquivo com a mesma lógica. Deveria ser extraído para uma função `isRequirementType(type)`.

---

### 5. Compatibilidade retroativa com XOR(42) inseguro (`utils.ts`)

```ts
// Backward compatibility with XOR(42) + base64
const xorDecoded = atob(enc).split('').map((c) => String.fromCharCode(c.charCodeAt(0) ^ 42)).join('');
```

**Problema:** Há código de backward compatibility para uma "criptografia" XOR com chave fixa `42` (trivialmente reversível). Essa compatibilidade deveria ter sido removida com um migration guide — mantê-la é um risco de segurança.

---

### 6. `processAnalytics` recebe `options: any` e depende do estado global (`analytics.ts`)

```ts
export function processAnalytics(items, tree, options: any = {}) {
```

A função acessa `state.globalActiveTypes` diretamente, mas também recebe dados via `options`. Mistura de injeção de dependência com acesso direto a singleton — dificulta testabilidade.

---

### 7. Versão do projeto fixada em `0.0.0` (`package.json`)

```json
"version": "0.0.0"
```

Projeto claramente em uso ativo mas nunca versionado. Falta um `CHANGELOG.md` e uma estratégia de versionamento semântico (SemVer).

---

### 8. CFD fixado em 180 dias (`analytics.ts`)

```ts
for (let i = 179; i >= 0; i--) { // sempre últimos 180 dias
```

O Cumulative Flow Diagram (CFD) usa sempre os últimos 180 dias sem controle de período pelo usuário. Isso é inconsistente com o Throughput e o Gantt, que têm controles de período.

---

### 9. `logger.ts` extremamente simples para o tamanho do projeto

O logger atual (766 bytes) provavelmente é apenas um wrapper de `console.log`. Com a complexidade do projeto, seria esperado pelo menos: níveis configuráveis, filtragem por módulo, e desativação em produção via `import.meta.env.PROD`.

---

### 10. `html2canvas` nas `dependencies` de produção mas de uso pontual

`html2canvas@1.4.1` está nas `dependencies` mas só é usado para export de imagens (feature opcional). O pacote tem ~2.5MB. Poderia ser carregado via CDN on-demand ou declarado apenas como peer, reduzindo o bundle principal.

---

## ✨ Features que fariam sentido implementar

### 🔴 Alta Prioridade

#### 1. Seleção de Período para o CFD
O CFD atualmente é fixo em 180 dias. Adicionar um seletor de período (30/60/90/180 dias ou custom) consistente com os outros gráficos seria uma melhoria de alta demanda.

#### 2. Multi-projeto / Multi-query simultâneos
Hoje só é possível carregar **uma query por vez**. Suporte a múltiplas queries simultâneas (com merge de dados) permitiria visões consolidadas de equipes que trabalham com múltiplos projetos no mesmo tenant.

#### 3. SLA / Políticas de WIP configuráveis
O gráfico de WIP mostra o estado atual, mas sem limites configuráveis. Adicionar limites de WIP por coluna (configurados pelo usuário), com alerta visual quando excedidos, transformaria o dashboard de observacional em prescritivo.

---

### 🟡 Média Prioridade

#### 4. Exportação para PDF (além de PNG)
A exportação atual gera apenas PNG. Uma exportação completa do dashboard em PDF (todos os gráficos em uma página com paginação automática) seria muito mais útil para relatórios executivos.

#### 5. Dashboard de Comparação Entre Sprints
Permitir comparar duas queries (ex: Sprint atual vs Sprint anterior) lado a lado, mostrando delta de throughput, lead time e distribuição de tipos. Ideal para cerimônias de Sprint Review.

#### 6. Notificações / Alertas de Anomalias
Detectar automaticamente anomalias (ex: item em "In Progress" há mais de X dias, throughput caindo >30% semana a semana) e exibir um painel de alertas no topo do dashboard.

#### 7. Filtros Avançados na Aba "Items"
Filtros mais ricos na aba de backlog: por assignee, por faixa de data, por estado, por tipo — tudo combinável. Hoje a filtragem é feita apenas por tipo via o filtro global.

#### 8. Persistência de Configuração de Filtros (localStorage)
As preferências de filtro (tipos ativos, período do Gantt etc.) são resetadas a cada refresh. Salvar essas preferências no `localStorage` melhoraria muito a experiência de uso recorrente.

---

### 🟢 Baixa Prioridade / Qualidade de Código

#### 9. Substituir `globalActiveTypes` por um `FilterStore` tipado
O estado de filtros globais está espalhado entre `state.globalActiveTypes`, `state.timelineActiveTypes` e `state.timelineActiveStates`. Um `FilterStore` dedicado tornaria o gerenciamento de filtros mais previsível e testável.

#### 10. Testes E2E com Playwright
O projeto tem testes unitários (vitest + happy-dom), mas nenhum teste de integração ou E2E. Playwright seria ideal para testar os fluxos críticos: setup → auth → load query → export.

#### 11. PWA (Progressive Web App)
Como o projeto já é 100% estático e client-side, adicionar um `service-worker` para cache offline o transformaria em uma PWA instalável — ideal para equipes que querem acesso rápido via ícone no celular/desktop.

#### 12. Suporte a Azure DevOps Server (on-premises)
Atualmente a URL é hardcoded para `https://dev.azure.com/{org}`. Organizações com Azure DevOps Server on-premises usam URLs customizadas (ex: `https://ado.empresa.com/tfs`). Adicionar um campo `baseUrl` no setup habilitaria esse cenário com zero impacto no fluxo atual.

---

## 📊 Resumo

| Categoria | Qtd | Severidade |
|-----------|-----|------------|
| Problemas de segurança | 2 | 🔴 Alta |
| Bugs / inconsistências de estado | 2 | 🔴 Alta |
| Qualidade de código / tipo | 4 | 🟡 Média |
| Dívida técnica / bundle | 2 | 🟢 Baixa |
| **Features prioritárias sugeridas** | 3 | 🔴 Alta |
| Features de média prioridade | 4 | 🟡 Média |
| Melhorias de qualidade / DX | 4 | 🟢 Baixa |
