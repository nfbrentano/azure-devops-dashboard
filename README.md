# 📊 Azure DevOps Analytics Dashboard

[![CI](https://github.com/nfbrentano/azure-devops-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/nfbrentano/azure-devops-dashboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/nfbrentano/azure-devops-dashboard.svg)](https://github.com/nfbrentano/azure-devops-dashboard/commits/main)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-blue.svg?logo=dependabot)](https://github.com/nfbrentano/azure-devops-dashboard/network/updates)

A premium, high-performance visualization tool for Azure DevOps, designed for clarity, security, and deep project insights. Built as a static application, it is perfectly suited for hosting on **GitHub Pages**.


---

## 🚀 Key Features & Supported Widgets

### 📊 Analytics & KPI Widgets
- **Lead Time & Cycle Time**: Real-time process efficiency tracking with historical comparison.
- **Throughput Chart**: Weekly delivery rate to monitor team velocity.
- **Workload by Assignee**: Visualization of item distribution across the team.
- **WIP by Kanban Column**: Balance your flow by monitoring work-in-progress limits.
- **Work Item Bottlenecks**: Measure average time spent in each Kanban column to identify flow constraints.
- **Cumulative Flow Diagram (CFD)**: Track work states over time to identify stability and bottlenecks.

### 🗺️ Visualization Widgets
- **Dynamic Hierarchical Gantt**: Interactive timeline for Epics, Features, and Stories with dependency visualization.
- **Activity Heatmap**: Visualize work frequency and team contribution patterns over the last 6 months.
- **Deep Backlog Analysis**: Detailed item view with "Aging" tracking for stalled tasks.

---

## 🔒 Security First (Static Hosting)

This dashboard uses a **client-side security model** designed for static environments like GitHub Pages:
- **AES-GCM Encryption**: Your PAT is encrypted with 256-bit AES-GCM via Web Crypto API.
- **In-Memory Cache**: Intelligent session-scoped caching that respects rate limits and never persists sensitive tokens.
- **Zero-Backend**: All processing happens in your browser. Your data never touches a third-party server.

---

## 🛠️ Step-by-Step Setup

### 1. Generate an Azure DevOps PAT
1.  Log in to [Azure DevOps](https://dev.azure.com/).
2.  Go to **User Settings** (top right) > **Personal Access Tokens**.
3.  Click **+ New Token**. Name: `Analytics Dashboard`.
4.  Set **Scopes** to `Custom defined`.
5.  Grant **Work Items: Read** (required for most charts) and **Analytics: Read** (if applicable).
6.  **Copy the token**: You will need it to unlock the dashboard.

### 2. Identify your Org & Project
- **Organization**: Found in your URL (`dev.azure.com/{organization}`).
- **Project**: Found in your URL right after the organization name.

### 3. Connect & Load
1.  Open the dashboard.
2.  Enter your **Organization**, **Project**, and **PAT**.
3.  Set a **Security Password** (to encrypt your PAT for the session).
4.  Select a **Saved Query** from the header to populate the charts.

---

## 🤝 How to Contribute

We welcome contributions! To maintain a high quality of code and UI:

1.  **Fork the repository** and create your branch from `main`.
2.  **Lint your code**: Run `npm run lint` before committing.
3.  **Add Tests**: If you add logic, add a corresponding test in `src/*.test.js`.
4.  **Run Tests**: Ensure `npm test` passes completely.
5.  **Submit a PR**: Describe your changes clearly and link any related issues.

### 💻 Development Setup
```bash
git clone https://github.com/nfbrentano/azure-devops-dashboard.git
cd azure-devops-dashboard
npm install
npm run dev   # Start development server
```

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
