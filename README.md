# Azure DevOps Dashboard

A powerful visualization tool for Azure DevOps work items, featuring custom Gantt charts and real-time project tracking. This branch is hosted on **GitHub Pages** for seamless embedding in Google Sites.

## How to Acess

To embed this dashboard in your Google Site:

1.  **Deployment**: The dashboard is hosted on GitHub Pages.
2.  **Paste the following URL:** [azure-devops-dashboard](https://nfbrentano.github.io/azure-devops-dashboard/)


## Setup Instructions

To use this dashboard, you will need a Personal Access Token (PAT) and your organization/project identifiers.

### 1. Generating a Personal Access Token (PAT)

1.  Log in to your [Azure DevOps](https://dev.azure.com/) account.
2.  In the top right corner, click on **User Settings** (the icon next to your profile picture) and select **Personal Access Tokens**.
3.  Click **+ New Token**.
4.  Enter a name for the token (e.g., "Azure Dashboard").
5.  Select the **Organization** where you want to use the token.
6.  Set the **Expiration** date (e.g., 90 days).
7.  Under **Scopes**, select **Custom defined**.
8.  Find **Work Items** and select **Read**.
9.  Click **Create**.
10. **CRITICAL**: Copy the token and save it somewhere safe. You will not be able to see it again.

### 2. Identifying Organization and Project Information

You can find these details directly from your browser's address bar when viewing your project:

**Format 1:** `https://dev.azure.com/{organization}/{project}`
- **Organization**: The value after `dev.azure.com/`.
- **Project**: The value after the organization name.

**Format 2 (Legacy):** `https://{organization}.visualstudio.com/{project}`
- **Organization**: The subdomain before `.visualstudio.com`.
- **Project**: The value after the domain.

## Features

- **Gantt Chart**: Visual representation of work item schedules.
- **Backlog View**: Detailed list of work items with status indicators.
- **Hierarchy Mapping**: Visualize relationships between Epics, Features, and Stories.
