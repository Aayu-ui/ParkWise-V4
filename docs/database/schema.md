# ParkWise V4 Database Schema Specification

- Status: Proposed
- Date: 2026-09-10
- Scope: PostgreSQL + PostGIS physical schema design

## Related Documents

- ADR 0001: System Architecture
- ADR 0002: Database Architecture
- Domain Model

---

## 1. Purpose

This document translates the approved ParkWise V4 domain model into a concrete PostgreSQL database design.

It defines:

- Tables
- Primary keys
- Foreign keys
- Core columns
- Data types
- Constraints
- Indexing strategy
- Relationships
- State representation
- Geospatial representation
- Audit requirements
- Migration boundaries

This document is the authoritative database schema specification for implementation.

It is not yet the migration implementation.

---

## 2. Database Technology

The production database will use:

- PostgreSQL
- PostGIS

PostgreSQL is the system of record for transactional and operational data.

PostGIS provides geospatial storage and querying for facilities and parking infrastructure.

Redis-compatible caching/event infrastructure is not a replacement for PostgreSQL persistence.

---

## 3. General Schema Conventions

### 3.1 Identifiers

All primary entity identifiers will use PostgreSQL UUID values.

UUIDs are preferred over sequential integer identifiers for externally exposed resources.

### 3.2 Naming

Database identifiers use:

- lowercase
- snake_case
- singular or plural naming consistently by table convention
- descriptive column names

Primary keys use:

```text
id
```
