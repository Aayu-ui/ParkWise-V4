\# ParkWise V4 Domain Model

\- Status: Proposed

\- Date: 2026-09-10

\- Scope: Core business domain

\- Related ADRs:

&#x20; - ADR 0001: System Architecture

&#x20; - ADR 0002: Database Architecture

\## 1. Purpose

This document defines the core business entities, their responsibilities, relationships, and lifecycle boundaries for ParkWise V4.

It is intentionally a domain model rather than a physical database schema.

The purpose is to establish a stable business model before implementing PostgreSQL tables, API endpoints, frontend state, or mobile application state.

The same domain model must be used consistently by:

\- Consumer Web

\- Android App

\- Operator Web

\- Staff Web

\- Admin Web

\- Backend services

\- Realtime infrastructure

\- AI/ML services

\- Future IoT integrations

\## 2. Core Domain

The ParkWise domain is organized around the following major areas:

```text

Identity

&#x20; ├── User

&#x20; ├── Role

&#x20; └── Vehicle



Parking Infrastructure

&#x20; ├── Facility

&#x20; ├── Floor

&#x20; ├── Zone

&#x20; └── ParkingSlot



Reservation

&#x20; └── Booking



Physical Parking

&#x20; ├── ParkingSession

&#x20; └── OccupancyRecord



Financial

&#x20; └── Payment



Governance

&#x20; └── AuditLog



```
