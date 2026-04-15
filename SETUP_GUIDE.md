# 🛠️ Azure DevOps Dashboard Setup Guide

This guide will help you find the necessary credentials to connect your Azure DevOps account to the dashboard.

---

## 🇧🇷 Português

### 1. Obtendo seu Personal Access Token (PAT)
O PAT é a "senha" que permite que o dashboard acesse seus dados de forma segura.

1.  Acesse seu [Azure DevOps](https://dev.azure.com/).
2.  No canto superior direito, clique no ícone de **User Settings** (Configurações do Usuário) ao lado da sua foto.
3.  Selecione **Personal Access Tokens**.
4.  Clique em **+ New Token**.
5.  Preencha as informações:
    - **Name**: `Analytics Dashboard` (ou qualquer nome de sua preferência).
    - **Organization**: Selecione sua organização.
    - **Scopes**: Recomendamos selecionar `Custom defined`.
    - **Permissões necessárias**:
        - **Work Items**: `Read` (Obrigatório para quase todos os gráficos).
        - **Analytics**: `Read` (Opcional, mas recomendado).
6.  Clique em **Create**.
7.  **IMPORTANTE**: Copie o token agora! Ele não será exibido novamente.

### 2. Identificando sua Organização e Projeto
Você pode encontrar esses dados diretamente na URL do seu navegador quando estiver visualizando seu projeto no Azure DevOps.

A estrutura da URL é: `https://dev.azure.com/{Organização}/{Projeto}`

- **Organização**: É o primeiro nome após `dev.azure.com/`.
- **Projeto**: É o nome que vem logo após a organização.

*Exemplo:* `https://dev.azure.com/acme-corp/portal-v3`
- Organização: `acme-corp`
- Projeto: `portal-v3`

---

## 🇺🇸 English

### 1. Getting your Personal Access Token (PAT)
The PAT is the "password" that allows the dashboard to access your data securely.

1.  Log in to your [Azure DevOps](https://dev.azure.com/).
2.  In the top right corner, click the **User Settings** icon next to your profile picture.
3.  Select **Personal Access Tokens**.
4.  Click **+ New Token**.
5.  Fill in the details:
    - **Name**: `Analytics Dashboard` (or any name you prefer).
    - **Organization**: Select your organization.
    - **Scopes**: We recommend choosing `Custom defined`.
    - **Required Permissions**:
        - **Work Items**: `Read` (Required for almost all charts).
        - **Analytics**: `Read` (Optional, but recommended).
6.  Click **Create**.
7.  **IMPORTANT**: Copy the token now! It will not be shown again.

### 2. Identifying your Organization and Project
You can find these details directly in your browser's URL when viewing your project in Azure DevOps.

The URL structure is: `https://dev.azure.com/{Organization}/{Project}`

- **Organization**: The first name after `dev.azure.com/`.
- **Project**: The name that follows the organization.

*Example:* `https://dev.azure.com/acme-corp/portal-v3`
- Organization: `acme-corp`
- Project: `portal-v3`

---

### 🔒 Security Note
This dashboard is a **static application**. Your PAT is encrypted in your browser's memory and sent directly to Azure DevOps APIs. It is never stored on any server other than your own browser's local storage (if you choose to save it).
