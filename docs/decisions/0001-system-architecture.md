\# ADR 0001: System Architecture

\- Status: Accepted

\- Date: 2026-09-10

\- Decision Owners: ParkWise V4 Engineering

\- Scope: Overall system architecture

\## Context

ParkWise V4 is being designed as a production-oriented intelligent parking, reservation, and mobility platform.

The platform must support:

\- Consumer web

\- Consumer Android

\- Operator web

\- Staff web

\- Admin web

\- Real-time parking availability

\- Reservations and parking sessions

\- Payments

\- Notifications

\- AI and machine learning

\- 3D parking visualization

\- Future IoT and occupancy integrations

The system must maintain a single source of truth for operational parking data and must support multiple clients without duplicating business logic.

The architecture must also allow individual subsystems to evolve independently without prematurely introducing unnecessary distributed-system complexity.

\## Decision

ParkWise V4 will use a \*\*modular monorepo with a centralized backend and PostgreSQL as the primary system of record\*\*.

The repository will be managed using:

\- pnpm workspaces

\- Turborepo

\- TypeScript for the primary application stack

\- Python for AI/ML services

The high-level structure is:

```text

apps/

&#x20; consumer-web/

&#x20; mobile/

&#x20; operator-web/

&#x20; staff-web/

&#x20; admin-web/



services/

&#x20; api/

&#x20; realtime/

&#x20; ai/

&#x20; notifications/



packages/

&#x20; ui/

&#x20; types/

&#x20; api-client/

&#x20; validation/

&#x20; config/



infrastructure/

&#x20; docker/

&#x20; deployment/



docs/

&#x20; architecture/

&#x20; api/

&#x20; database/

&#x20; decisions/



ml/

&#x20; datasets/

&#x20; training/

&#x20; evaluation/

&#x20; models/



```
