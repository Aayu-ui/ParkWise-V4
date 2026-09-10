\# ADR 0002: Database Architecture

\- Status: Accepted

\- Date: 2026-09-10

\- Decision Owners: ParkWise V4 Engineering

\- Scope: Primary data storage and database architecture

\## Context

ParkWise V4 requires a reliable transactional data layer for an intelligent parking, reservation, and mobility platform.

The database must support:

\- Users and roles

\- Parking facilities

\- Floors and zones

\- Parking slots

\- Reservations

\- Parking sessions

\- Payments and payment references

\- Physical occupancy

\- Geospatial parking search

\- Audit records

\- AI/ML outputs where persistence is required

\- Future IoT and sensor integrations

The system must support multiple clients, including consumer web and Android, while maintaining one authoritative source of operational data.

Parking reservations introduce concurrency requirements because multiple users may attempt to reserve the same parking slot at approximately the same time.

The system must therefore prioritize transactional correctness, data integrity, and recoverability over convenience.

\## Decision

ParkWise V4 will use \*\*PostgreSQL as the primary relational database and system of record\*\*, with \*\*PostGIS\*\* enabled for geospatial functionality.

The initial architecture will use PostgreSQL directly through the backend application. Database access will be centralized through the ParkWise API rather than allowing clients to connect directly to PostgreSQL.

```text

Consumer Web ──────┐

&#x20;                  │

Android App ───────┤

&#x20;                  │

Operator Web ──────┤

&#x20;                  │

Staff Web ─────────┤

&#x20;                  │

Admin Web ─────────┤

&#x20;                  │

&#x20;                  ▼

&#x20;            ParkWise API

&#x20;                  │

&#x20;                  ▼

&#x20;       PostgreSQL + PostGIS



```
