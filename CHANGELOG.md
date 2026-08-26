# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-25

### 🔒 Security & Cryptography
- **Random Salt Encryption (`v2`)**: Replaced the hardcoded salt with a 16-byte cryptographically secure random salt generated per PAT encryption (`crypto.getRandomValues`).
- **Legacy Salt Migration**: Supported seamless backward compatibility reading legacy `v1` PAT payloads (`iv:ciphertext`) while migrating to `v2:salt:iv:ciphertext`.
- **Removed XOR Insecurity**: Eliminated the legacy XOR(42) fallback parser.

### 🐛 Bug Fixes & State Isolation
- **Timeline vs Gantt Offset Separation**: Added `timelineOffset` to `AppState` to completely isolate the navigation state of the Portfolio Timeline from the Dashboard Hierarchical Gantt.
- **Requirement Backlog Type Filtering**: Centralized and deduplicated story/requirement identification with `isRequirementType(type, metadata)`.

### ⚡ Analytics & Features
- **Configurable CFD Period Selector**: Added selector in the CFD chart supporting 30, 60, 90, and 180 days with persistent user choice.
- **Anomaly & Bottleneck Alerts Banner**: Automated detection of stale In-Progress items (>14 days), column WIP overload (>8 items), and severe column bottlenecks (>7 days average).
- **WIP Limits Visual Highlighting**: Overloaded WIP columns are highlighted dynamically in the WIP Kanban chart.
- **Search and Filter in Item Details**: Added instant search input filtering by Title, ID, or Assignee in the Item Details tab.
- **PDF Report Export**: Added print-optimized stylesheet and a dedicated PDF export button.
- **Filter State Persistence**: Added automatic `localStorage` persistence for visible work item types, timeline filters, and view preferences.

### 🧼 Code Quality & Architecture
- **Strict TypeScript Typing**: Defined formal interfaces for `ComputedMetrics`, `CFDDataPoint`, `AgingItem`, `ThroughputDataPoint`, `BottleneckResult`, and `AnomalyAlert`, replacing loose `any[]` declarations.
- **Modular Logger**: Enhanced `logger.ts` with module tagging (`logger.forModule`), level formatting, and development mode gating.
