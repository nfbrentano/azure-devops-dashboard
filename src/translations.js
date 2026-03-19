export const translations = {
    'en': {
        // Nav Tabs
        'tab-dashboard': 'Dashboard',
        'tab-items': 'Item Details',
        'tab-setup': 'Setup',
        'theme-toggle-title': 'Toggle Dark/Light Mode',
        'lang-toggle-title': 'Switch to Portuguese',

        // Global Controls
        'query-selector-placeholder': 'Select Analytics Query...',
        'refresh-btn-title': 'Refresh Data',

        // Setup View
        'setup-title': 'Azure DevOps Dashboard',
        'setup-subtitle': 'Connect your account to view metrics',
        'label-org': 'Organization',
        'label-project': 'Project',
        'label-pat': 'Personal Access Token (PAT)',
        'btn-connect': 'Connect and Load Queries',
        'btn-logout': 'Logout',

        // Metrics Guide
        'metrics-guide-title': 'Metrics Guide',
        'metric-lead-time-title': 'Lead Time',
        'metric-lead-time-desc': 'Measures the total time from when an item is <strong>created</strong> until it is <strong>completed</strong>. Reflects the end-to-end customer experience.',
        'metric-cycle-time-title': 'Cycle Time',
        'metric-cycle-time-desc': 'Measures the time an item was actively <strong>in development</strong> (from \'In Progress\' to completion). Focuses on execution efficiency.',
        'metric-comparison-title': 'Lead vs Cycle Time',
        'metric-comparison-desc': 'Compares average Lead and Cycle Time of the current period with the previous one, identifying improvement trends or flow bottlenecks.',
        'metric-portfolio-title': 'Features & Portfolio',
        'metric-portfolio-desc': 'Macro view of Epic and Feature progress, showing how items are distributed across various workflow stages.',
        'metric-aging-title': 'Work Item Aging',
        'metric-aging-desc': 'Measures how many days an item has been in <strong>In Progress</strong> without updates. Helps identify forgotten items or operational bottlenecks.',
        'metric-gantt-title': 'Hierarchical Gantt',
        'metric-gantt-desc': 'Hierarchical timeline showing the duration and nesting of items, allowing visualization of project sequencing and dependencies.',

        // Item Details View
        'items-title': 'Item Details & Aging',
        'items-subtitle': 'Detailed analysis of inactivity and item health',
        'chart-aging-title': 'Work Item Aging (In Progress)',
        'chart-assignee-title': 'Workload by Assignee',
        'chart-cfd-title': 'Cumulative Flow Diagram (CFD)',
        'chart-activity-title': 'Delivery Activity (Last 6 Months)',

        // Dashboard View
        'dashboard-title': 'Development Analytics',
        'active-query-placeholder': 'Select a query to begin',
        'chart-comparison-title': 'Lead vs Cycle Time Comparison',
        'chart-throughput-title': 'Throughput (Items per Week) — Requirement Backlog',
        'portfolio-section-title': 'Features & Portfolio',
        'gantt-section-title': 'Hierarchical Gantt',

        // Gantt Controls
        'gantt-period-total': 'General View (Auto)',
        'gantt-period-year': 'Yearly',
        'gantt-period-trimester': 'Quarterly',
        'gantt-period-bimester': 'Bimonthly',
        'gantt-period-month': 'Monthly',
        'gantt-period-week': 'Weekly',

        // Legend & Labels
        'legend-type-title': 'Item Classification',
        'legend-status-title': 'Delivery Status (Bar Color)',
        'status-backlog': 'Backlog',
        'status-inprogress': 'In Progress',
        'status-done': 'Done',
        'status-removed': 'Removed',

        // Messages
        'msg-no-items': 'No items found in this query.',
        'msg-auth-failed': 'Connection failed. Check your PAT and settings.',
        'msg-loading': 'Loading...',
        'msg-aging-empty': 'No items currently in execution (In Progress) found for this query.',
        'msg-assignee-empty': 'No assignees found for the query items.',
        'msg-cfd-empty': 'Insufficient data to generate CFD.',
        'msg-gantt-empty': 'No tasks found in this period.',
        'msg-portfolio-empty': 'No active Features/Epics found.',
        
        // Dynamic Labels
        'label-query': 'Query',
        'label-days': 'Days',
        'label-quantity': 'Quantity',
        'label-delivered-items': 'Delivered Items',
        'label-delivered': 'Delivered',
        'label-items-count': 'Work Items Count',
        'label-number-of-items': 'Number of Items',
        'label-days-inactive': 'Days Inactive',
        'label-days-since-update': 'Days Since Last Update',
        'label-items': 'Items'
    },
    'pt-br': {
        // Nav Tabs
        'tab-dashboard': 'Dashboard',
        'tab-items': 'Detalhes dos Itens',
        'tab-setup': 'Configuração',
        'theme-toggle-title': 'Alternar Modo Escuro/Claro',
        'lang-toggle-title': 'Mudar para Inglês',

        // Global Controls
        'query-selector-placeholder': 'Selecionar Consulta...',
        'refresh-btn-title': 'Atualizar Dados',

        // Setup View
        'setup-title': 'Azure DevOps Dashboard',
        'setup-subtitle': 'Conecte sua conta para visualizar métricas',
        'label-org': 'Organização',
        'label-project': 'Projeto',
        'label-pat': 'Personal Access Token (PAT)',
        'btn-connect': 'Conectar e Carregar Consultas',
        'btn-logout': 'Sair da Conta',

        // Metrics Guide
        'metrics-guide-title': 'Guia de Métricas',
        'metric-lead-time-title': 'Lead Time',
        'metric-lead-time-desc': 'Mede o tempo total desde que um item é <strong>criado</strong> até ser <strong>concluido</strong>. Reflete a experiência completa do cliente ou solicitante.',
        'metric-cycle-time-title': 'Cycle Time',
        'metric-cycle-time-desc': 'Mede o tempo em que o item esteve efetivamente <strong>em desenvolvimento</strong> (desde \'In Progress\' até ser concluído). Foca na eficiência da execução.',
        'metric-comparison-title': 'Lead vs Cycle Time',
        'metric-comparison-desc': 'Compara o Lead Time e Cycle Time médio do período atual com o anterior, permitindo identificar tendências de melhoria ou gargalos no fluxo.',
        'metric-portfolio-title': 'Features & Portfolio',
        'metric-portfolio-desc': 'Visualização macro do progresso de Epics e Features, mostrando como os itens estão distribuídos pelas diversas etapas do fluxo de trabalho.',
        'metric-aging-title': 'Work Item Aging',
        'metric-aging-desc': 'Mede quantos dias um item em <strong>In Progress</strong> está sem receber atualizações. Ajuda a identificar itens esquecidos ou gargalos operacionais.',
        'metric-gantt-title': 'Hierarchical Gantt',
        'metric-gantt-desc': 'Linha do tempo hierárquica que mostra a duração e o encadeamento dos itens, permitindo visualizar o sequenciamento e dependências do projeto.',

        // Item Details View
        'items-title': 'Item Details & Aging',
        'items-subtitle': 'Análise detalhada de inatividade e saúde dos itens',
        'chart-aging-title': 'Work Item Aging (In Progress)',
        'chart-assignee-title': 'Workload by Responsável',
        'chart-cfd-title': 'Cumulative Flow Diagram (CFD)',
        'chart-activity-title': 'Atividade de Entrega (Últimos 6 Meses)',

        // Dashboard View
        'dashboard-title': 'Development Analytics',
        'active-query-placeholder': 'Selecione uma consulta para começar',
        'chart-comparison-title': 'Comparativo Lead vs Cycle Time',
        'chart-throughput-title': 'Throughput (Itens por Semana) — Requirement Backlog',
        'portfolio-section-title': 'Features & Portfolio',
        'gantt-section-title': 'Hierarchical Gantt',

        // Gantt Controls
        'gantt-period-total': 'Visão Geral (Auto)',
        'gantt-period-year': 'Anual',
        'gantt-period-trimester': 'Trimestral',
        'gantt-period-bimester': 'Bimestral',
        'gantt-period-month': 'Mensal',
        'gantt-period-week': 'Semanal',

        // Legend & Labels
        'legend-type-title': 'Classificação de Itens',
        'legend-status-title': 'Status de Entrega (Cor da Barra)',
        'status-backlog': 'Backlog',
        'status-inprogress': 'In Progress',
        'status-done': 'Done',
        'status-removed': 'Removed',

        // Messages
        'msg-no-items': 'Nenhum item encontrado nesta consulta.',
        'msg-auth-failed': 'Falha ao conectar. Verifique seu PAT e configurações.',
        'msg-loading': 'Carregando...',
        'msg-aging-empty': 'Nenhum item em execução (In Progress) encontrado para esta consulta.',
        'msg-assignee-empty': 'Nenhum responsável encontrado para os itens da consulta.',
        'msg-cfd-empty': 'Dados insuficientes para gerar o CFD.',
        'msg-gantt-empty': 'Nenhuma tarefa encontrada neste período.',
        'msg-portfolio-empty': 'Nenhuma Feature/Epic ativa encontrada.',

        // Dynamic Labels
        'label-query': 'Consulta',
        'label-days': 'Dias',
        'label-quantity': 'Quantidade',
        'label-delivered-items': 'Itens Entregues',
        'label-delivered': 'Entregues',
        'label-items-count': 'Contagem de Itens',
        'label-number-of-items': 'Número de Itens',
        'label-days-inactive': 'Dias Inativo',
        'label-days-since-update': 'Dias desde a última atualização',
        'label-items': 'Itens'
    }
};
