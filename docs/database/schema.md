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

Redis-compatible caching and event infrastructure is not a replacement for PostgreSQL persistence.

---

## 3. General Schema Conventions

### 3.1 Identifiers

All primary entity identifiers will use PostgreSQL UUID values.

UUIDs are preferred over sequential integer identifiers for externally exposed resources.

### 3.2 Naming

Database identifiers use:

- lowercase
- snake_case
- descriptive names
- consistent table naming conventions

Primary keys use:

````text
id
### 3.3 Timestamps

All persisted timestamps use:

```text
TIMESTAMPTZ---

## 4. State Model

The schema represents three separate concepts.

### 4.1 Booking State

```text
PENDING
HELD
CONFIRMED
CANCELLED
EXPIRED
CHECKED_IN
COMPLETED---

## 5. Core Tables

The initial schema consists of the following core tables:

```text
users
roles
user_roles
vehicles
facilities
floors
zones
parking_slots
bookings
parking_sessions
occupancy_records
payments
audit_logs---

## 6. users

Stores authenticated platform users.

### Key fields

```text
id
email
password_hash
first_name
last_name
phone
is_active
created_at
updated_at---

## 7. roles

Defines application-level roles.

### Initial roles

```text
CONSUMER
OPERATOR
STAFF
ADMIN---

## 8. user_roles

Associates users with roles.

### Key fields

```text
user_id
role_id
created_at---

## 9. vehicles

Stores vehicles associated with platform users.

A vehicle belongs to a user and may be used across multiple bookings and parking sessions.

### Key fields

```text
id
user_id
registration_number
vehicle_type
make
model
color
created_at
updated_at---

## 10. facilities

Represents a physical parking facility operated through ParkWise.

### Key fields

```text
id
name
description
address_line_1
address_line_2
city
state
postal_code
country
location
timezone
is_active
created_at
updated_at---

## 11. floors
The database contract is considered locked only after the implementation and automated tests demonstrate that the defined invariants are actually enforced.---

## 12. zones

Represents a logical or physical zone within a parking floor.

Examples include:

```text
A
B
Premium
EV
Accessible
Motorcycle---

## 13. parking_slots

Represents an individual physical parking position within a parking zone.

This is a core operational entity used by customer applications, operator and staff portals, realtime synchronization, 3D visualization, occupancy tracking, and future IoT integrations.

### Key fields

```text
id
zone_id
slot_number
vehicle_type
operational_status
occupancy_state
occupancy_source
occupancy_updated_at
sensor_id
position
metadata
created_at
updated_at---

## 14. bookings

Represents a customer's reservation of a parking slot for a defined time interval.

A booking represents a reservation agreement. It does not, by itself, prove that a vehicle is physically occupying the parking slot.

### Key fields

```text
id
user_id
vehicle_id
parking_slot_id
status
starts_at
ends_at
hold_expires_at
subtotal
tax
total
currency
idempotency_key
created_at
updated_at
cancelled_at---

## 15. parking_sessions

Represents an actual physical parking stay.

A parking session is deliberately separate from a booking. A booking represents a reservation, while a parking session represents the vehicle's actual presence in the parking facility.

This separation is required to correctly support walk-ins, early departures, overstays, occupancy tracking, and actual parking duration.

### Key fields

```text
id
booking_id
user_id
vehicle_id
parking_slot_id
entry_time
exit_time
entry_source
exit_source
status
overstay_started_at
created_at
updated_at---

## 16. occupancy_records

Stores the historical observations of physical parking-slot occupancy.

This table preserves the history of occupancy changes instead of relying only on the current occupancy state stored on `parking_slots`.

Occupancy records are important for realtime operations, sensor integration, troubleshooting, analytics, anomaly detection, and future ML training and evaluation.

### Key fields

```text
id
parking_slot_id
occupancy_state
source
confidence
observed_at
sensor_id
metadata
created_at---

## 17. payments

Stores payment transactions associated with ParkWise bookings and parking sessions.

The payment provider is an external system. ParkWise stores the application-side payment state and provider identifiers required for secure reconciliation.

The database record must never be treated as proof of payment merely because a client reports success.

### Key fields

```text
id
booking_id
parking_session_id
provider
provider_payment_id
provider_order_id
status
amount
currency
verified_at
created_at
updated_at---

## 18. audit_logs

Stores security-sensitive, administrative, financial, and operational actions performed within the ParkWise platform.

Audit logs provide an append-oriented record of important system activity for security investigation, operational troubleshooting, accountability, and compliance.

### Key fields

```text
id
actor_user_id
action
entity_type
entity_id
request_id
ip_address
user_agent
metadata
created_at---

## 19. Relationships

The core ParkWise schema is organized around users, vehicles, parking facilities, reservations, physical parking sessions, occupancy observations, payments, and audit history.

The relationships must preserve clear separation between reservation state, physical occupancy, and financial state.

### User relationships

A user may have multiple roles and multiple vehicles.

```text
User
 â”œâ”€â”€< UserRole >â”€â”€ Role
 â”‚
 â””â”€â”€< Vehicle---

## 20. Delete and Historical Data Policy

ParkWise must prioritize historical integrity over physical deletion of business records.

Records that participate in completed transactions, financial activity, physical parking activity, occupancy history, or security auditing must normally be retained.

### General principle

The preferred approach for important operational entities is:

```text
ACTIVE
  â†“
DEACTIVATED / RETIRED---

## 21. Indexing Strategy

Indexes must support the actual query patterns of the ParkWise platform.

Indexes must not be added indiscriminately. Every index should have a clear purpose related to:

- application queries
- booking concurrency
- realtime state retrieval
- geographic discovery
- operational dashboards
- payment reconciliation
- audit investigation
- analytical workloads

The final index definitions will be implemented through version-controlled database migrations.

### General principles

- Every primary key automatically provides a primary-key index.
- Foreign-key columns that are frequently used for joins or filtering should be indexed.
- Frequently queried state fields should be indexed where query patterns justify it.
- Composite indexes should reflect actual query predicates and ordering.
- Partial indexes should be used when only a subset of records participates in a common query.
- Spatial indexes should be used for PostGIS geographic queries.
- Indexes must be evaluated using actual query plans and realistic workloads.
- Excessive indexes must be avoided because they increase storage requirements and write overhead.

### Users

Important indexes include:

```text
users.email---

## 22. Booking Concurrency

Booking creation is a concurrency-sensitive operation.

The database must prevent two concurrent requests from successfully reserving the same parking slot for overlapping active reservation intervals.

Application-level availability checks alone are not sufficient because two requests may observe the same slot as available before either transaction commits.

### Core invariant

For a given parking slot, two active reservations must not overlap in time.

Conceptually:

```text
Same parking slot
        +
Overlapping reservation intervals
        +
Active reservation states
        â†“
Conflict

## 23. Geospatial Design

### 23.1 Purpose

ParkWise uses geospatial data to support location-based parking discovery, facility search, distance calculations, map visualization, and future routing capabilities.

The geospatial model must remain separate from the logical parking hierarchy so that location data can be used without making geographic coordinates the source of truth for parking availability.

The database remains the authoritative source for parking facilities, slots, bookings, sessions, and operational state.

### 23.2 Geospatial Technology

ParkWise uses PostgreSQL with PostGIS for geospatial storage and queries.

PostGIS is responsible for:

- storing geographic coordinates
- spatial indexing
- radius searches
- distance calculations
- bounding-box queries
- geographic filtering
- future spatial analysis

The application must use parameterized spatial queries through the backend.

Clients must never connect directly to PostgreSQL or PostGIS.

### 23.3 Coordinate Reference System

All geographic coordinates exposed as geographic locations must use:

- SRID: `4326`
- Coordinate system: WGS 84

Latitude and longitude values must follow the standard geographic convention:

- latitude: `-90` to `90`
- longitude: `-180` to `180`

The backend must validate coordinates before persistence.

### 23.4 Facility Location

The `facilities` table contains the primary geographic location of a parking facility.

The authoritative facility location is represented using:

```text
location GEOGRAPHY(POINT, 4326)

## 24. 3D Digital Twin Mapping

### 24.1 Purpose

ParkWise uses a 3D digital twin to provide an interactive visual representation of a parking facility.

The digital twin represents the physical and logical structure of a facility, including:

- facility
- floors
- zones
- parking slots
- aisles
- ramps
- gates
- other supported structural elements

The 3D digital twin is a visualization and interaction layer over authoritative ParkWise data.

It must not become a separate source of truth for parking availability, reservations, occupancy, or operational state.

### 24.2 Digital Twin Architecture

The conceptual architecture is:

```text
PostgreSQL
    â†“
Facility / Floor / Zone / Slot data
    â†“
ParkWise API
    â†“
3D Mapping Layer
    â†“
Three.js / React Three Fiber
    â†“
Interactive Digital Twin### 24.3 Logical-to-3D Mapping

Every visual parking element representing a real parking slot must map to the corresponding database identifier.

Conceptually:

```text
parking_slots.id
        â†“
3D object identifier
        â†“
Interactive slot### 24.4 Parking Slot Identity

The database `parking_slots.id` is the authoritative identity of a parking slot.

The 3D model must never generate an independent business identity that replaces the database identifier.

A 3D object may have a rendering-specific identifier, but it must retain the corresponding ParkWise slot identifier.

Example conceptual mapping:

```text
3D Object
  objectId: render-slot-001
  parkingSlotId: <database UUID>### 24.5 Facility Hierarchy

The digital twin follows the database hierarchy:

```text
Facility
    â†“
Floor
    â†“
Zone
    â†“
Parking Slot### 24.6 3D Asset Format

3D assets should use web-compatible formats such as:

- GLB
- GLTF

GLB/GLTF assets may be created or optimized using Blender.

The production application should load optimized assets suitable for web and Android performance.

Large unoptimized source files must not be shipped directly to clients.### 24.7 Blender Workflow

Blender is the primary environment for preparing production 3D assets.

The conceptual workflow is:

```text
Facility Design
    â†“
Blender
    â†“
Model Cleanup
    â†“
Optimization
    â†“
GLB / GLTF
    â†“
ParkWise 3D Client### 24.8 External AI-Assisted Asset Generation

AI-assisted tools such as Higgsfield may be used during asset creation where useful.

The production dependency boundary is:

```text
Higgsfield
    â†“
Asset Generation / Assistance
    â†“
Blender
    â†“
Validated GLB / GLTF
    â†“
ParkWise### 24.9 Asset Validation

Before a 3D asset is used in production, it should be validated for:

- correct scale
- correct orientation
- valid geometry
- acceptable polygon count
- texture size
- material compatibility
- loading performance
- collision or interaction requirements
- correct mapping to facility elements

The asset must not contain accidental duplicated parking-slot representations that conflict with the database model.### 24.10 Local 3D Coordinate System

The 3D scene may use a facility-local coordinate system rather than raw latitude and longitude.

Conceptually:

```text
Geographic Facility Location
          â†“
Local Coordinate Origin
          â†“
Facility 3D Coordinate System
          â†“
3D Objects### 24.11 Database-to-Scene Mapping

The 3D scene should be generated or configured using authoritative facility data.

Conceptually:

```text
Facility
    â†“
Floors
    â†“
Zones
    â†“
Parking Slots
    â†“
3D Slot Mapping### 24.12 Dynamic Parking State

The visual state of a parking slot is derived from the backend.

For example:

```text
AVAILABLE
RESERVED
OCCUPIED
OUT_OF_SERVICE### 24.13 Realtime 3D Updates

Realtime parking events must update the corresponding 3D objects without requiring a full scene reload.

Example:

```text
PARKING_SLOT_UPDATED
        â†“
parkingSlotId
        â†“
Find mapped 3D object
        â†“
Update visual state### 24.14 User Interaction

Users may interact with individual 3D parking slots.

Supported interactions may include:

- selecting a slot
- viewing slot information
- checking current availability
- viewing reservation eligibility
- initiating reservation
- navigating to the selected slot

Interaction must resolve the real `parking_slot_id`.

A client-side visual selection must not directly create or modify a booking.### 24.15 Reservation Flow From 3D

Selecting a parking slot in the 3D scene may initiate the normal reservation flow:

```text
3D Slot Selection
    â†“
parking_slot_id
    â†“
Backend availability validation
    â†“
Temporary hold / reservation workflow
    â†“
Payment where required
    â†“
Booking confirmation### 24.16 Multi-Floor Visualization

The digital twin must support facilities containing multiple floors.

The user should be able to identify the current floor and switch between available floors.

Conceptually:

```text
Facility
â”œâ”€â”€ Floor 1
â”œâ”€â”€ Floor 2
â”œâ”€â”€ Floor 3
â””â”€â”€ ...### 24.17 Floor and Zone Mapping

Every rendered floor and zone should map to the corresponding database identifier.

Example:

```text
3D Floor
    â†“
floor_id

3D Zone
    â†“
zone_id### 24.18 Gates, Ramps, and Aisles

The digital twin may contain structural elements such as:

- entry gates
- exit gates
- ramps
- aisles
- pedestrian paths
- barriers

These elements may be visualization-only when they do not require independent business state.

A structural element should become a dedicated domain entity only when it requires independent:

- operational state
- permissions
- telemetry
- configuration
- lifecycle management
- auditing
- realtime updates

For example:

```text
Visual-only aisle
        â†“
3D asset

Operational gate
        â†“
Dedicated domain model may be introduced### 24.19 Internal Navigation

The digital twin is designed to support future internal navigation through the parking facility.

Internal navigation is distinct from external road navigation.

External navigation may route a user from their current location to the facility entrance.

Internal navigation may route a user from the facility entrance to:

- a parking slot
- a floor
- a zone
- an exit
- another supported facility destination

The conceptual flow is:

```text
User
  â†“
Facility Entrance
  â†“
Internal Navigation Graph
  â†“
Floor / Zone / Aisle / Ramp
  â†“
Parking Slot### 24.20 3D and Occupancy

The 3D digital twin may visualize the physical occupancy state of parking slots.

The source of occupancy remains the authoritative backend occupancy model.

The 3D renderer must never infer occupancy from:

- camera appearance
- user interaction
- local client state
- animation state
- stale cached data

### Occupancy data flow

The intended flow is:

```text
Occupancy Provider
    â†“
Occupancy Service
    â†“
ParkWise API
    â†“
PostgreSQL
    â†“
Current ParkingSlot State
    â†“
Realtime Event
    â†“
3D Digital Twin### 24.21 3D and Reservations

The 3D digital twin may be used as an entry point into the ParkWise reservation workflow.

Selecting a parking slot in the 3D interface must initiate the same reservation process used by the other ParkWise clients.

The 3D client must not implement a separate reservation engine.

### Reservation flow

The intended flow is:

```text
3D Slot Selection
        â†“
parking_slot_id
        â†“
Backend availability validation
        â†“
Booking eligibility validation
        â†“
Temporary hold
        â†“
Payment workflow where required
        â†“
Verified payment
        â†“
Booking confirmation
        â†“
Realtime state update
        â†“
3D scene synchronization### 24.22 3D Failure and Recovery

The 3D digital twin must fail independently from the transactional parking system.

A failure in 3D rendering, asset loading, or scene synchronization must not corrupt or alter:

- bookings
- parking sessions
- payments
- occupancy records
- parking-slot state

### Asset-loading failure

If a required 3D asset cannot be loaded:

```text
3D Asset Load Failure
        â†“
Fallback / Error State
        â†“
Core parking functionality remains available### 24.23 3D Mapping Errors

The digital twin must explicitly detect and handle inconsistencies between the authoritative database model and the 3D scene.

A mapping error must never silently create, delete, or modify a business entity.

### Missing database mapping

If a 3D object exists but does not reference a valid database entity:

```text
3D Object
    â†“
Invalid / Missing parking_slot_id
    â†“
Mapping Error### 24.24 Performance

The 3D digital twin must provide an interactive experience without allowing rendering performance to compromise the core parking system.

Performance requirements apply separately to:

- web
- Android
- lower-powered supported devices
- high-density parking facilities
- realtime parking updates

### Rendering principle

The 3D client should render only the scene content required for the current user context.

Where practical:

```text
Facility
    â†“
Selected Floor
    â†“
Visible Zones
    â†“
Required 3D Objects### 24.25 Progressive Loading

Large parking facilities may contain substantial amounts of 3D geometry, textures, metadata, and dynamic parking state.

The digital twin should therefore support progressive loading so that essential functionality becomes available before the complete 3D scene has finished loading.

### Loading stages

The preferred conceptual loading sequence is:

```text
Facility Metadata
        â†“
Floor Metadata
        â†“
Current Parking State
        â†“
Required 3D Asset
        â†“
Visible 3D Scene
        â†“
Non-critical Visual Enhancements### 24.26 3D Failure States

The 3D digital twin must provide explicit failure states whenever required assets, backend data, realtime synchronization, or rendering capabilities are unavailable.

A failure state must never be represented as valid parking availability or successful transactional state.

### Asset failure

If a 3D asset cannot be loaded:

```text
3D Asset Failure
      â†“
Explicit Error / Fallback State
      â†“
Core Parking Data Remains Available### 24.27 Source of Truth

The 3D digital twin is a downstream representation of the authoritative ParkWise application state.

The authority hierarchy is:

```text
PostgreSQL
    â†“
ParkWise Backend
    â†“
API / Realtime
    â†“
3D Digital Twin### 24.28 Implementation Boundary

This section defines the implementation boundary between the database, backend, 3D client, and supporting services.

The 3D digital twin must be implemented as a presentation and interaction layer over the authoritative ParkWise domain model.

### Database responsibilities

The database is responsible for authoritative persisted data such as:

```text
facility
floor
zone
parking slot
booking
parking session
occupancy
payment
audit### 24.29 Definition of Done

The 3D digital-twin implementation is considered complete only when all required functional, technical, consistency, and verification requirements have been satisfied.

### Functional requirements

The implementation must support:

- facility visualization
- floor navigation
- zone navigation or filtering where required
- parking-slot selection
- authoritative parking-state visualization
- reservation initiation through the shared booking workflow
- realtime parking-state updates
- navigation visualization where implemented
- appropriate loading states
- appropriate error states
- non-3D fallback behavior where required

Every visible interactive element must have a defined purpose and must perform a real supported action.

No decorative control may be presented as functional when it has no implemented behavior.

### Identity and mapping requirements

The implementation must verify that:

- every interactive parking slot maps to a real `parking_slot_id`
- floor mappings resolve to real `floor_id` values
- zone mappings resolve to real `zone_id` values
- facility mappings resolve to real `facility_id` values
- invalid mappings are detectable
- duplicate mappings are detectable
- orphaned 3D objects are detectable
- retired parking resources cannot become accidentally reservable through the 3D scene

### Backend integration requirements

The implementation must verify that:

- 3D clients communicate through the ParkWise API
- clients never connect directly to PostgreSQL
- authentication is enforced
- authorization is enforced
- booking actions use the shared booking workflow
- payment workflows remain backend-authoritative
- parking-session workflows remain backend-authoritative
- occupancy state comes from the authoritative occupancy workflow
- AI/ML outputs cannot bypass backend business rules

### Database consistency requirements

The implementation must maintain:

```text
3D State
    â†“
representation of
    â†“
Backend State
    â†“
authoritative persistence
    â†“
PostgreSQL---

## 25. IoT Readiness

ParkWise is designed to support future IoT-based parking and occupancy systems without making physical sensors a requirement for the initial product release.

The IoT architecture must integrate with the existing parking domain rather than introducing a separate source of truth.

### 25.1 Purpose

Future IoT integrations may provide real-world observations such as:

- parking-slot occupancy
- vehicle entry
- vehicle exit
- gate events
- sensor health
- device status
- charging activity
- environmental information where required

These observations must be normalized before they affect authoritative ParkWise operational state.

### 25.2 Integration Boundary

The intended architecture is:

```text
Physical Device
      â†“
IoT Gateway / Provider
      â†“
Event Ingestion
      â†“
Validation / Normalization
      â†“
Occupancy Service
      â†“
ParkWise Backend
      â†“
PostgreSQL
      â†“
Realtime / Clients---

## 26. AI and ML Data Boundary

AI and ML capabilities are downstream consumers of authoritative ParkWise data.

They may provide predictions, recommendations, forecasts, anomaly detection, and optimization signals, but they must not become an independent source of truth for core transactional state.

### 26.1 Purpose

The AI/ML architecture is intended to support capabilities such as:

- parking recommendations
- occupancy prediction
- demand forecasting
- arrival prediction
- anomaly detection
- dynamic pricing recommendations
- operator optimization
- personalization
- capacity planning

These capabilities must be introduced only where they provide a measurable product benefit.

AI/ML must not be added merely for demonstration or presentation purposes.

### 26.2 Authoritative Data

The following remain authoritative within the ParkWise platform:

```text
users
facilities
floors
zones
parking_slots
bookings
parking_sessions
payments
occupancy_records
audit_logs---

## 27. Migration Strategy

All changes to the ParkWise database schema must be implemented through version-controlled database migrations.

The migration system is the executable mechanism that turns the approved database specification into an actual PostgreSQL schema.

Database changes must never depend on undocumented manual SQL performed directly against production.

### 27.1 Purpose

The migration system must provide:

- deterministic schema evolution
- reproducible environments
- reviewable database changes
- safe deployment
- rollback planning where practical
- automated migration validation
- synchronization between application code and database structure

The migration history is part of the ParkWise source code and must be committed to Git.

### 27.2 Migration Source of Truth

The migration files are the authoritative implementation of database structure.

The relationship is:

```text
Database Schema Specification
        â†“
Migration Implementation
        â†“
PostgreSQL Database---

## 28. Production Seed Policy

ParkWise production must begin with an honest and controlled dataset.

Production must never be populated with fabricated users, facilities, bookings, occupancy readings, payments, analytics, or other operational records merely to make the application appear complete.

### 28.1 Purpose

The seed-data policy exists to ensure that:

- production data represents real operational state
- development data cannot accidentally appear as production data
- test fixtures remain isolated
- empty production states are handled correctly
- required system configuration can still be provisioned safely

### 28.2 Production Starting State

A new production database should contain no fabricated operational records.

The initial operational dataset must contain:

```text
No users
No vehicles
No facilities
No floors
No zones
No parking slots
No bookings
No parking sessions
No occupancy records
No payments
No audit history generated from fake activity

## 29. Database Security

The ParkWise database contains critical transactional, operational, financial, and potentially sensitive information.

Database security must therefore be implemented as a layered control rather than relying on application code alone.

### 29.1 Security Principles

The database security model follows:

```text
Least Privilege
      â†“
Strong Authentication
      â†“
Network Restriction
      â†“
Encryption
      â†“
Authorization
      â†“
Auditing
      â†“
Monitoring

## 30. Backup and Recovery

PostgreSQL is a critical system-of-record component for ParkWise.

Loss, corruption, or prolonged unavailability of the production database can affect:

- users
- facilities
- parking infrastructure
- bookings
- parking sessions
- occupancy history
- payments
- audit records

The production database therefore requires a defined backup, recovery, and disaster-recovery strategy.

### 30.1 Purpose

The backup and recovery strategy must provide:

- protection against data loss
- recovery from infrastructure failure
- recovery from accidental deletion
- recovery from database corruption
- defined recovery objectives
- tested restoration procedures
- documented operational responsibilities

A backup is not considered reliable merely because the backup job completed successfully.

A backup is reliable only when the team can successfully restore usable database state from it.

### 30.2 Recovery Objectives

Production recovery planning must define:

```text
RPO â€” Recovery Point Objective
RTO â€” Recovery Time Objective### 30.3 Backup Frequency

Backup frequency must be selected according to:

- Recovery Point Objective (RPO)
- database write volume
- business criticality
- storage cost
- recovery architecture
- operational requirements

The final production backup schedule must be explicitly documented.

A generic default schedule must not be assumed to satisfy ParkWise requirements.

---

### 30.4 Backup Retention

The production backup strategy must define retention periods for different backup classes.

Possible categories include:

```text
daily backups
weekly backups
monthly backups
long-term archival backups
````

Retention must consider:

- operational recovery
- financial requirements
- legal requirements
- privacy requirements
- disaster recovery
- storage cost

Old backups must be removed according to the approved retention policy.

---

### 30.5 Backup Encryption

Production backups must be encrypted at rest.

Encryption keys must be protected using the selected infrastructure's secure key-management mechanism.

Backup encryption credentials and keys must never be committed to Git.

Access to encrypted backup data must be restricted to authorized recovery and infrastructure operations.

---

### 30.6 Backup Storage Separation

Backups should be stored separately from the primary database infrastructure where practical.

The recovery architecture should protect against:

```text
primary database failure
storage failure
accidental deletion
operator error
infrastructure failure
regional outage
```

A backup stored only on the same failed infrastructure is not sufficient protection against infrastructure-level disaster.

---

### 30.7 Geographic Resilience

For production deployments with sufficient availability requirements, backups should be replicated across an appropriate geographic or infrastructure boundary.

The selected strategy depends on:

- RPO
- RTO
- business requirements
- cloud provider
- budget
- geographic availability

The recovery boundary must be documented before production launch.

---

### 30.8 Backup Integrity

The backup system should verify that backup operations completed successfully.

Validation may include:

```text
backup completion
backup metadata
checksum validation
backup size validation
restore testing
schema validation
critical-data validation
```

A backup job reporting success does not by itself prove that the backup can be restored.

---

### 30.9 Restore Testing

Database restoration must be tested periodically.

A representative restore test should follow:

```text
Backup
  â†“
Isolated Recovery Environment
  â†“
PostgreSQL Restoration
  â†“
PostGIS Verification
  â†“
Schema Verification
  â†“
Application Connectivity
  â†“
Critical Data Validation
```

The restored database must be checked for:

- schema correctness
- tables
- constraints
- indexes
- PostGIS functionality
- critical records
- application compatibility

---

### 30.10 Recovery Environment

Restore tests must use an isolated environment.

Recovered production data may contain sensitive information and must therefore be protected using:

- access controls
- encryption
- network restrictions
- appropriate logging
- retention controls

A recovery environment must not become an unmanaged copy of production.

---

### 30.11 Recovery from Accidental Deletion

The recovery strategy must support recovery from accidental deletion where feasible.

The conceptual process is:

```text
Accidental Deletion
      â†“
Detection
      â†“
Determine Required Recovery Point
      â†“
Restore / Point-in-Time Recovery
      â†“
Validate Affected Data
      â†“
Controlled Service Recovery
```

The team must define whether the incident requires:

```text
full database restoration
point-in-time restoration
targeted data recovery
forward-fix correction
```

The selected method must preserve transactional integrity.

---

### 30.12 Recovery from Corruption

If database corruption is suspected:

```text
Application Traffic
      â†“
Contain / Restrict Access
      â†“
Investigation
      â†“
Identify Last Known Good Recovery Point
      â†“
Restore
      â†“
Validate
      â†“
Resume Service
```

Evidence required for incident investigation must be preserved where appropriate.

---

### 30.13 Recovery from Infrastructure Failure

If the primary PostgreSQL environment becomes unavailable:

```text
Primary Database Failure
      â†“
Infrastructure Recovery / Failover
      â†“
Database Availability Restored
      â†“
Backend Reconnection
      â†“
Data Validation
      â†“
Service Restoration
```

The exact failover mechanism depends on the selected PostgreSQL deployment architecture.

---

### 30.14 High Availability

Backup and recovery are separate from high availability.

The production environment may additionally use:

```text
standby database
replication
automatic failover
multi-zone deployment
```

where required.

High availability reduces downtime.

Backups protect against data loss and provide historical recovery capability.

Both concerns must be planned independently.

---

### 30.15 Replication

If PostgreSQL replication is used:

```text
Primary
   â†“
Replica
```

the replica must not be treated as a replacement for independent backups.

Replication can also reproduce:

```text
accidental deletions
corrupt writes
incorrect migrations
malicious changes
```

Therefore:

```text
Replication â‰  Backup
```

---

### 30.16 Read Replicas

Read replicas may be introduced to support:

- analytical workloads
- reporting
- read scaling
- administrative dashboards

Read replicas do not replace backups.

The designated PostgreSQL primary remains the transactional source of truth.

---

### 30.17 Disaster Recovery

The disaster-recovery process must define responses to scenarios such as:

```text
database host failure
cloud-region outage
storage failure
credential compromise
accidental destructive migration
data corruption
```

The recovery plan must identify:

- responsible personnel
- recovery environment
- required credentials
- recovery point
- restoration procedure
- validation procedure
- service restoration procedure
- communication responsibilities

---

### 30.18 Disaster-Recovery Dependencies

Database recovery depends on more than PostgreSQL.

The plan must consider:

```text
application infrastructure
database credentials
secret management
networking
DNS
object storage
payment provider
map provider
IoT provider
realtime infrastructure
AI/ML services
```

Restoring PostgreSQL alone does not guarantee complete platform recovery.

---

### 30.19 Recovery and Migration Compatibility

A recovered database must remain compatible with the repository's migration history.

The intended architecture is:

```text
Git Repository
      â†“
Migration History
      â†“
Recovered PostgreSQL
      â†“
Schema Validation
      â†“
Application
```

Manual schema changes must not be required merely to make a recovered database compatible with the application.

---

### 30.20 Recovery and PostGIS

Recovery validation must include PostGIS.

At minimum, restoration testing must verify:

```text
PostGIS extension
GEOGRAPHY columns
GEOMETRY columns
spatial indexes
representative spatial query
```

A recovery is incomplete if transactional tables are restored but spatial functionality is broken.

---

### 30.21 Recovery and Bookings

Booking integrity must be validated after database recovery.

The validation must confirm:

```text
booking states
reservation intervals
foreign keys
unique constraints
concurrency constraints
idempotency structures
```

The recovered system must not permit duplicate or conflicting reservations because a required constraint or index was lost.

---

### 30.22 Recovery and Payments

Payment history requires additional validation.

The recovery process must verify:

```text
payment records
provider identifiers
payment statuses
amounts
currency
verification information
```

Financial history must not be reconstructed through assumptions.

If payment state is uncertain, the backend must reconcile with the payment provider rather than fabricate a new payment state.

---

### 30.23 Recovery and Occupancy

Recovery must distinguish between:

```text
historical occupancy records
current parking-slot state
```

After database restoration, current physical state may need to be reconciled against live occupancy sources.

Conceptually:

```text
Database Restored
      â†“
Historical Occupancy Available
      â†“
IoT / Occupancy Reconnection
      â†“
Fresh Observations
      â†“
Current Slot-State Reconciliation
```

Historical observations must remain preserved.

---

### 30.24 Recovery and Realtime

Realtime infrastructure may lose connectivity during database recovery.

After recovery:

```text
Database Available
      â†“
Backend Reconnects
      â†“
Realtime Service Reconnects
      â†“
Clients Reconcile State
```

Clients must not assume that they received every state change surrounding the recovery period.

API reconciliation must be used where required.

---

### 30.25 Recovery and 3D

The 3D digital twin is downstream from authoritative database state.

After recovery:

```text
PostgreSQL Restored
      â†“
Backend State Validated
      â†“
API / Realtime Available
      â†“
3D Client Reconciliation
      â†“
Current Parking State Rendered
```

The 3D client must not independently reconstruct authoritative parking state.

---

### 30.26 Recovery and IoT

Following a database or backend outage, IoT devices may continue generating events.

The recovery strategy must define handling for:

```text
events generated during outage
provider-queued events
duplicate events after reconnection
late observations
device reconnection
```

The system must prevent duplicate business transitions during recovery.

---

### 30.27 Recovery and AI/ML

AI/ML services may depend on restored operational data.

After recovery:

```text
Database Restored
      â†“
Data Validation
      â†“
Feature Pipeline Validation
      â†“
AI / ML Services Resume
```

Models must not resume against incomplete or corrupted inputs without appropriate validation.

---

### 30.28 Recovery and Audit

Important recovery operations should be documented and auditable where appropriate.

Examples include:

```text
database restored
failover executed
backup restored
production database replaced
recovery completed
```

Recovery itself must remain accountable.

---

### 30.29 Backup Monitoring

Production backup operations must be monitored.

Important signals include:

```text
backup success/failure
backup duration
backup size
storage usage
WAL/archive health
replication lag where applicable
restore-test status
```

A failed backup process must produce an operational alert.

---

### 30.30 Recovery Alerts

Operations should receive alerts when:

```text
backup fails
backup retention is violated
WAL archival fails
storage approaches capacity
replication becomes unhealthy
scheduled restore tests fail
```

The exact alerting system depends on the deployment observability architecture.

---

### 30.31 Recovery Runbook

The team must maintain a documented database-recovery runbook.

The runbook should include:

```text
incident detection
initial containment
backup selection
recovery-point selection
restore procedure
credential requirements
database validation
application validation
realtime validation
3D validation
IoT reconciliation
payment reconciliation
service restoration
post-recovery checks
```

The runbook must be updated when infrastructure changes.

---

### 30.32 Recovery Permissions

Only authorized personnel or controlled infrastructure may perform production recovery operations.

Recovery credentials must be protected separately from normal application runtime credentials where practical.

The application runtime must not automatically receive permission to restore or destroy the production database.

---

### 30.33 Recovery Security

Recovery operations must maintain production-level security.

Recovered databases must not be:

```text
publicly exposed
left with default credentials
accessible through development accounts
copied to unmanaged devices
```

---

### 30.34 Recovery Validation

Before restoring production traffic, validate:

```text
database connectivity
schema
migrations
foreign keys
constraints
indexes
PostGIS
booking integrity
payment integrity
occupancy state
audit records
application compatibility
```

Where appropriate, targeted smoke tests must validate critical user workflows.

---

### 30.35 Critical Workflow Validation

Post-recovery smoke tests should cover:

```text
user authentication
facility discovery
parking-slot availability
booking creation
booking conflict prevention
booking retrieval
payment-state retrieval
parking-session state
occupancy retrieval
realtime synchronization
```

The exact test suite will evolve with the implemented platform.

---

### 30.36 Recovery Completion

Recovery is considered complete only after:

```text
Database Healthy
      â†“
Backend Healthy
      â†“
Critical APIs Healthy
      â†“
Realtime Healthy
      â†“
Clients Reconciled
      â†“
Critical Workflows Verified
```

Restoring the database service alone is not sufficient.

---

### 30.37 Backup Retention and Privacy

Backup retention must account for applicable privacy requirements.

The team must determine how backup retention interacts with requests to:

- delete personal information
- anonymize personal information
- restrict access to personal information

Deleting data from the primary database does not necessarily remove it immediately from historical backups.

Backup lifecycle and privacy policy must therefore be coordinated.

---

### 30.38 Backup Cost Management

Backup design should balance:

```text
recovery capability
retention
storage cost
operational complexity
```

Cost optimization must not weaken the approved RPO or RTO.

---

### 30.39 Recovery Testing Frequency

Recovery tests should be performed periodically according to the platform's operational risk.

Testing may include:

```text
full database restore
point-in-time restore
failover test
application reconnection
critical workflow validation
```

The exact schedule must be documented before production launch.

---

### 30.40 Recovery Evidence

Every formal recovery test should record:

```text
test date
backup / recovery point used
duration
result
issues discovered
corrective actions
```

This provides evidence that recovery procedures are operational rather than theoretical.

---

### 30.41 Backup Failure Response

If a scheduled backup fails:

```text
Backup Failure
      â†“
Alert
      â†“
Investigation
      â†“
Retry / Repair
      â†“
Backup Verification
      â†“
Recovery Posture Restored
```

Repeated backup failures must be treated as an operational risk.

---

### 30.42 Recovery from Human Error

The recovery strategy must consider mistakes by:

```text
developer
operator
administrator
deployment process
migration process
```

Human error must have an established incident-response and recovery path.

---

### 30.43 Recovery and Destructive Migrations

Before a high-risk destructive migration, the deployment process must determine whether an additional backup or recovery checkpoint is required.

The decision should consider:

```text
migration risk
data volume
reversibility
business criticality
recovery time
```

Recovery from destructive migrations must not rely on undocumented emergency SQL.

---

### 30.44 Implementation Boundary

The implementation phase will define:

- backup provider
- backup schedule
- retention policy
- WAL/archive configuration where applicable
- point-in-time recovery
- high availability
- replication
- disaster recovery
- restore testing
- recovery runbook
- monitoring
- alerting
- credential controls
- recovery environment
- backup privacy handling

The final implementation must be compatible with the selected PostgreSQL hosting environment.

---

### 30.45 Definition of Done

Backup and recovery are considered production-ready only when:

- automated production backups are enabled
- backup retention is defined
- backups are encrypted
- backup storage is protected
- RPO is documented
- RTO is documented
- recovery responsibilities are documented
- point-in-time recovery is configured where required
- high-availability strategy is defined where required
- backup failures generate alerts
- restore procedures are documented
- restore testing has succeeded
- PostGIS restoration has been verified
- booking integrity has been verified after recovery
- payment integrity has been verified after recovery
- occupancy reconciliation has been verified
- realtime recovery has been verified
- 3D state reconciliation has been verified
- IoT recovery behavior is defined
- AI/ML recovery dependencies are documented
- recovery operations are access-controlled
- recovered data is protected
- destructive migration recovery procedures exist
- recovery evidence is retained
- critical application workflows pass post-recovery validation
- relevant integration tests pass
- relevant end-to-end tests pass
- typecheck passes
- lint passes
- formatting passes---

## 31. Implementation Boundary

This document defines the intended database contract before executable database migrations are implemented.

The implementation must preserve the architectural and domain boundaries established by:

- ADR 0001: System Architecture
- ADR 0002: Database Architecture
- Domain Model
- Database Schema Specification

The database, backend, clients, realtime infrastructure, 3D system, IoT services, and AI/ML services each have explicit responsibilities.

No client-side feature may bypass the authoritative backend and database boundaries.

### 31.1 Database Responsibilities

PostgreSQL is responsible for authoritative persisted application state.

The database owns the persistence and integrity of:

````text
users
roles
user_roles
vehicles
facilities
floors
zones
parking_slots
bookings
parking_sessions
occupancy_records
payments
audit_logs
### 31.2 Migration Responsibilities

Version-controlled migrations translate the schema specification into executable PostgreSQL structures.

Migrations are responsible for implementing:

```text
PostgreSQL extensions
PostGIS
state types or equivalent constraints
tables
foreign keys
unique constraints
check constraints
indexes
spatial indexes
booking concurrency protection
required database defaults
required triggers where justified
````

Migration behavior must remain consistent with this schema specification.

### 31.3 Backend Responsibilities

The ParkWise backend is responsible for:

```text
authentication
authorization
input validation
business rules
booking workflows
parking-session workflows
payment workflows
occupancy processing
realtime event generation
administrative workflows
3D data access
IoT ingestion
AI/ML orchestration
```

The backend is the boundary between clients and the database.

Conceptually:

```text
Client
   â†“
Authentication
   â†“
Authorization
   â†“
Validation
   â†“
Business Rules
   â†“
Database Transaction
   â†“
Authoritative State
```

### 31.4 Client Responsibilities

Supported client applications include:

```text
Consumer Web
Consumer Android
Operator Web
Staff Web
Admin Web
3D Digital Twin
```

Clients are responsible for:

- presentation
- user interaction
- navigation
- loading states
- error states
- empty states
- temporary presentation state
- authorized realtime rendering

Clients must not:

```text
directly connect to PostgreSQL
bypass backend authorization
create bookings without backend validation
confirm payments independently
determine authoritative occupancy
modify database state directly
```

### 31.5 API Boundary

All client access to domain state must occur through authenticated backend APIs.

The API layer is responsible for:

- request validation
- authentication
- authorization
- domain orchestration
- database interaction
- error mapping
- response shaping
- observability

Clients must not depend directly on database structures.

### 31.6 Booking Boundary

All reservation creation must use the shared backend booking service.

The intended workflow is:

```text
Consumer Web / Android / 3D
            â†“
       Booking API
            â†“
      Authorization
            â†“
       Validation
            â†“
    Booking Service
            â†“
 PostgreSQL Transaction
            â†“
Concurrency Enforcement
            â†“
      Booking State
```

There must not be separate reservation engines for:

```text
Web
Android
3D
```

unless a future reviewed architecture decision explicitly requires one.

### 31.7 Booking Concurrency Boundary

The backend booking service orchestrates reservation creation.

PostgreSQL enforces the final no-double-booking invariant.

Therefore:

```text
Backend Validation
       +
Database Constraint
       =
Booking Safety
```

Application-level availability checks must never be the sole protection against conflicting reservations.

### 31.8 Payment Boundary

Payment processing remains behind the backend.

The conceptual workflow is:

```text
Client
   â†“
Payment Request
   â†“
ParkWise Backend
   â†“
Payment Provider
   â†“
Verified Provider Result
   â†“
Payment State
   â†“
Booking / Session Workflow
```

Clients must not directly mark a payment as captured, verified, refunded, or successful.

### 31.9 Occupancy Boundary

Occupancy information enters ParkWise through the occupancy-processing workflow.

The intended architecture is:

```text
Sensor / ANPR / Gate / Operator / Simulator
                    â†“
             Occupancy Ingestion
                    â†“
                Validation
                    â†“
             Occupancy Service
                    â†“
             Occupancy Record
                    â†“
          Current Slot State
```

Clients consume the resulting state.

A client must not determine authoritative physical occupancy independently.

### 31.10 Realtime Boundary

Realtime infrastructure distributes domain changes after the appropriate backend/database consistency point.

The flow is:

```text
Database Transaction
       â†“
Backend Domain Event
       â†“
Realtime Infrastructure
       â†“
Authorized Clients
```

Realtime delivery is not an alternative source of truth.

If events are missed:

```text
Realtime Reconnection
       â†“
API Reconciliation
       â†“
Current Backend State
```

### 31.11 3D Boundary

The 3D digital twin is a visualization and interaction layer.

It is responsible for:

- rendering facility geometry
- displaying parking state
- selecting mapped objects
- visualizing routes
- initiating supported reservation interactions
- displaying loading states
- displaying error and fallback states

It is not responsible for:

```text
direct database access
booking enforcement
payment verification
occupancy determination
authorization
transaction management
```

The relationship is:

```text
PostgreSQL
    â†“
Backend
    â†“
API / Realtime
    â†“
3D Client
```

### 31.12 3D Mapping Boundary

Interactive 3D parking objects must resolve to authoritative database identifiers.

At minimum:

```text
facility_id
floor_id
zone_id
parking_slot_id
```

must be resolvable for the applicable scene objects.

Mapping failures must fail closed for operational actions.

A missing or invalid mapping must never cause the client to invent a new parking entity.

### 31.13 IoT Boundary

IoT systems are sources of physical observations.

They must not directly mutate arbitrary domain tables.

The intended boundary is:

```text
IoT Device / Provider
        â†“
Authenticated Ingestion
        â†“
Validation
        â†“
Normalization
        â†“
Occupancy Service
        â†“
PostgreSQL
```

IoT systems must not directly modify:

```text
users
roles
bookings
payments
```

outside approved backend workflows.

### 31.14 AI/ML Boundary

AI/ML systems operate on approved authoritative data and produce derived information.

They may provide:

```text
predictions
recommendations
forecasts
anomaly signals
optimization suggestions
```

They must not bypass backend business rules.

The boundary is:

```text
Authoritative Data
       â†“
Feature Pipeline
       â†“
AI / ML
       â†“
Prediction / Recommendation
       â†“
Backend Validation
       â†“
Controlled Action
```

AI/ML systems must not directly create or modify:

```text
bookings
payments
occupancy state
parking-session state
```

### 31.15 Analytics Boundary

Analytical workloads should remain separated from critical transactional paths where required.

Analytics may consume:

```text
booking data
parking-session data
occupancy history
facility data
payment summaries
```

Analytical processing must not modify transactional state unless a specifically approved backend workflow exists.

As scale increases, the architecture may introduce:

```text
read replicas
materialized views
aggregated tables
data warehouse
analytical database
```

without changing PostgreSQL's role as the transactional system of record.

### 31.16 Authorization Boundary

Authorization is enforced at the backend.

The backend must determine whether an authenticated actor can perform an action.

Examples include:

```text
Consumer
  â†“
Own resources

Operator
  â†“
Authorized facility operations

Staff
  â†“
Authorized operational actions

Admin
  â†“
Administrative operations
```

Frontend visibility is not authorization.

Hiding a control does not prevent an unauthorized API request.

### 31.17 Data Validation Boundary

Validation occurs at multiple layers.

The intended model is:

```text
Client Validation
       â†“
Backend Validation
       â†“
Database Constraints
```

Client validation improves user experience.

Backend validation enforces application-level business rules.

Database constraints provide final persistence integrity.

Critical business rules must not rely exclusively on frontend validation.

### 31.18 Error Boundary

Errors must remain within controlled subsystem boundaries.

For example:

```text
Database Constraint Violation
       â†“
Backend Error Mapping
       â†“
API Error
       â†“
Client Error State
```

Raw PostgreSQL errors must not be exposed to end users.

Stable application-level error codes should be used where appropriate.

Examples include:

```text
BOOKING_CONFLICT
SLOT_UNAVAILABLE
HOLD_EXPIRED
PAYMENT_FAILED
UNAUTHORIZED
FORBIDDEN
RESOURCE_NOT_FOUND
SERVICE_UNAVAILABLE
```

### 31.19 Transaction Boundary

Operations requiring multiple related database mutations must use appropriate transactions.

Example:

```text
BEGIN
   â†“
Update Booking
   â†“
Create Audit Record
   â†“
Update Related State
   â†“
COMMIT
```

A failed transaction must not leave partially committed business state.

The backend service defines the transaction boundary.

### 31.20 Audit Boundary

Important administrative, security, operational, and financial actions must be auditable.

The responsible backend workflow should create an audit record where required.

Conceptually:

```text
Authorized Action
       â†“
Business Mutation
       +
Audit Event
```

Audit events remain separate from business entities while preserving appropriate correlation information.

### 31.21 Secret Boundary

Secrets must remain outside source-controlled code and client bundles.

Examples include:

```text
database credentials
payment-provider secrets
map-provider credentials
IoT credentials
AI-service credentials
JWT signing secrets
encryption keys
```

Secrets must be supplied through secure environment or secret-management systems.

### 31.22 Environment Boundary

The platform must support separate:

```text
Development
Staging
Production
```

environments with separate:

```text
databases
credentials
secrets
external-service configuration
test fixtures
```

Development data must not automatically cross into production.

### 31.23 Testing Boundary

Every critical architecture boundary must have automated tests.

Examples include:

```text
API â†” Database
Booking â†” Database
Payment â†” Provider
Occupancy â†” Database
Realtime â†” Backend
3D â†” API
IoT â†” Occupancy Service
AI/ML â†” Backend
```

Tests must cover both successful and failure scenarios.

### 31.24 End-to-End Boundary

Critical workflows must be tested across the complete stack rather than as disconnected screens.

Representative booking flow:

```text
User
   â†“
Web / Android / 3D
   â†“
API
   â†“
Authentication
   â†“
Authorization
   â†“
Validation
   â†“
Booking Service
   â†“
PostgreSQL
   â†“
Concurrency Protection
   â†“
Booking Created
   â†“
Realtime Event
   â†“
Other Clients
```

A feature is not complete merely because its interface renders correctly.

### 31.25 Cross-Client Consistency

All supported clients must use the same authoritative backend contract.

For example:

```text
Android
   â†“
Booking API
   â†“
PostgreSQL
   â†“
Realtime
   â”œâ”€â”€ Consumer Web
   â”œâ”€â”€ Operator Web
   â”œâ”€â”€ Staff Web
   â”œâ”€â”€ Admin Web
   â””â”€â”€ 3D Digital Twin
```

The visual representation may differ between clients, but the underlying business state must converge.

### 31.26 No Client-Specific Source of Truth

The following must never become independent authoritative sources:

```text
Web local state
Android local database
3D scene
browser storage
mobile cache
AI model output
IoT device state
realtime event stream
```

These systems may temporarily hold representations of state.

Authority remains with the appropriate backend/domain data source.

### 31.27 Caching Boundary

Caching may be introduced to improve performance.

Cached data may include:

```text
facility metadata
static 3D assets
non-critical read models
recent presentation state
```

Caching must never bypass required validation for:

```text
booking creation
payment verification
authorization
occupancy mutation
parking-session mutation
administrative operations
```

Cached operational state must be treated as potentially stale.

### 31.28 Background Job Boundary

Background jobs may perform:

```text
hold expiration
occupancy processing
notifications
reconciliation
analytics
scheduled maintenance
model inference
```

Background jobs must use authenticated internal boundaries and appropriate database transactions.

Operations that may be retried must be designed to be idempotent.

### 31.29 External Service Boundary

External integrations may include:

```text
payment provider
map provider
geocoding provider
IoT provider
AI/ML service
notification provider
```

Each integration should be isolated behind an application-level abstraction where practical.

Provider-specific behavior must not unnecessarily leak into the core domain model.

### 31.30 Provider Failure

External service failures must be isolated.

For example:

```text
Map Provider Failure
       â†“
Map Feature Degraded
       â†“
Booking System Continues
```

or:

```text
AI Service Failure
       â†“
Recommendation Unavailable
       â†“
Normal Non-ML Workflow
```

A provider outage must not result in fabricated successful application state.

### 31.31 Observability Boundary

Critical services must expose enough telemetry to diagnose problems.

The implementation should support:

```text
logs
metrics
traces
request IDs
domain-event correlation
database monitoring
```

Observability data must not expose secrets or unnecessary personal information.

### 31.32 Performance Boundary

Performance optimizations must not weaken correctness.

For example:

```text
Caching
  â‰ 
Skip booking validation
```

and:

```text
3D Optimization
  â‰ 
Use stale occupancy as authoritative
```

Correctness remains the primary requirement.

### 31.33 Security Boundary

Security controls must apply consistently across:

```text
Web
Android
Operator
Staff
Admin
3D
API
Realtime
IoT
AI/ML
Database
```

A less-visible subsystem must not become an unintended authorization or data-access bypass.

### 31.34 Implementation Changes

Implementation may refine technical details when required by:

- PostgreSQL behavior
- migration-tool limitations
- infrastructure constraints
- measured performance
- provider requirements

Implementation changes must not silently alter:

- domain meaning
- ownership
- authorization boundaries
- booking invariants
- payment authority
- occupancy authority
- historical integrity

Changes to these concepts require a reviewed documentation update.

### 31.35 Definition of Done

The implementation boundary is considered complete only when:

- database responsibilities are clearly separated
- migration responsibilities are defined
- backend responsibilities are defined
- client responsibilities are defined
- booking operations use a shared backend service
- payment operations remain backend-authoritative
- occupancy operations remain backend-authoritative
- realtime remains a delivery mechanism
- 3D remains a visualization and interaction layer
- IoT remains behind an ingestion boundary
- AI/ML remains behind a controlled backend boundary
- authorization is enforced server-side
- validation occurs at appropriate layers
- transactions protect multi-step mutations
- auditability is preserved
- secrets remain outside client and source-controlled code
- environments are isolated
- caching does not bypass correctness
- external-service failures are handled safely
- background jobs are retry-safe
- cross-client consistency is tested
- complete end-to-end workflows are tested
- database constraints enforce critical invariants
- relevant unit tests pass
- relevant integration tests pass
- relevant end-to-end tests pass
- typecheck passes
- lint passes
- formatting passes---

## 32. Definition of Done

The ParkWise database schema is considered implementation-ready only when the defined domain model, database constraints, application boundaries, and operational requirements are consistently represented.

The schema must not be considered complete merely because the Markdown document exists.

The executable implementation must enforce the important invariants defined throughout this specification.

### 32.1 Schema Requirements

The implementation must provide:

- all required core tables
- primary keys
- foreign keys
- appropriate unique constraints
- required check constraints
- controlled state representation
- timestamp conventions
- monetary precision
- PostGIS support
- spatial indexes
- appropriate operational indexes

The resulting PostgreSQL schema must correspond to the approved domain model.

### 32.2 Data Integrity

The database must prevent invalid core relationships and invalid persisted states.

At minimum:

```text
invalid foreign-key references
duplicate unique identifiers
invalid booking intervals
invalid monetary values
invalid occupancy confidence values
unsupported state values
```

must be rejected at the appropriate persistence boundary.

### 32.3 Booking Integrity

The booking system is considered complete only when:

- overlapping protected reservations cannot both be committed
- adjacent reservations are allowed
- cancelled reservations no longer block capacity
- expired holds no longer block capacity
- temporary holds have defined expiration
- booking creation is transaction-safe
- duplicate booking requests are idempotent
- booking ownership is validated
- vehicle eligibility is validated
- backend availability is revalidated before reservation
- frontend availability is not treated as authoritative

### 32.4 Occupancy Integrity

The occupancy system is considered complete only when:

- current occupancy is distinguishable from occupancy history
- occupancy sources are recorded
- `UNKNOWN` remains distinct from `VACANT`
- stale observations are handled explicitly
- duplicate observations are handled safely where provider identifiers exist
- conflicting observations are resolved by backend logic
- simulator observations are clearly identified
- simulator data cannot silently become production occupancy
- sensor failure cannot automatically create fabricated vacancy

### 32.5 Parking Session Integrity

Parking-session implementation must verify that:

- actual parking sessions are separate from bookings
- walk-in sessions are supported
- active sessions represent physical parking activity
- exit timestamps are valid
- duplicate checkout operations are handled safely
- overstays are detectable
- historical session records remain intact
- parking-slot relationships remain valid

### 32.6 Payment Integrity

Payment implementation must verify that:

- amounts use appropriate monetary precision
- currency is explicit
- provider identifiers are retained
- payment state is backend-authoritative
- provider webhooks are verified
- provider events are handled idempotently
- refunds follow a controlled workflow
- payment credentials are not stored unnecessarily
- financial history is preserved
- uncertain payment state is reconciled with the provider

### 32.7 Audit Integrity

Audit implementation must verify that:

- important security actions are auditable
- important administrative actions are auditable
- important operational actions are auditable
- important financial actions are auditable
- actor identity is recorded where applicable
- system-generated events can be distinguished from human actions
- request correlation is available where appropriate
- sensitive secrets are excluded
- audit records are append-oriented
- required audit history cannot be casually deleted

### 32.8 Geospatial Integrity

Geospatial implementation must verify that:

- PostGIS is enabled
- geographic coordinates use the approved coordinate system
- coordinate ranges are validated
- facility locations support spatial queries
- spatial indexes are created where required
- nearby-facility queries use authoritative backend data
- distance units are explicitly defined
- external map providers do not become the source of truth for ParkWise entities

### 32.9 3D Digital Twin Integrity

The 3D implementation must verify that:

- every interactive parking object maps to a real `parking_slot_id`
- facility/floor/zone mappings are valid
- mapping errors are detectable
- duplicate mappings are detectable
- retired resources cannot accidentally become reservable
- 3D state comes from backend-authoritative data
- 3D rendering does not become a second source of truth
- realtime updates reach the correct object
- missed events can be reconciled
- 3D failures do not corrupt transactional data
- non-3D fallback behavior exists where required

### 32.10 IoT Integrity

IoT implementation must verify that:

- devices use authenticated ingestion
- devices do not directly modify PostgreSQL
- observations are validated
- source information is retained
- duplicate events are handled safely
- out-of-order events are handled
- stale observations are recognized
- device failures are observable
- simulator data is isolated
- operator overrides are authorized and auditable

### 32.11 AI/ML Integrity

AI/ML implementation must verify that:

- predictions are distinguishable from observed facts
- model versions can be identified
- prediction timestamps are available where required
- training-data provenance is maintained
- simulator data is distinguishable from production data
- stale predictions are handled
- model failures have deterministic fallback behavior
- AI/ML cannot directly bypass booking rules
- AI/ML cannot directly bypass payment workflows
- AI/ML cannot directly overwrite authoritative occupancy
- model-driven operational actions are auditable where required

### 32.12 Security Integrity

Database and backend security must verify that:

- clients cannot directly connect to PostgreSQL
- database credentials are not exposed to clients
- least-privilege access is implemented
- production access is restricted
- development and production credentials are separated
- secrets are not committed to Git
- sensitive values are not unnecessarily logged
- payment credentials are not stored unnecessarily
- authorization is enforced server-side
- realtime access is authorized
- IoT ingestion is authenticated
- AI/ML data access is restricted

### 32.13 Historical Integrity

Historical integrity is maintained when:

```text
completed bookings
parking sessions
payment records
occupancy records
audit records
```

remain available according to the applicable retention requirements.

Retiring or deactivating an entity must not silently rewrite historical records.

### 32.14 Delete Integrity

The implementation must verify that destructive operations cannot accidentally remove required historical business data.

Particular care is required around:

```text
users
vehicles
facilities
floors
zones
parking_slots
bookings
parking_sessions
payments
occupancy_records
audit_logs
```

Where appropriate, deactivation or retirement should be preferred over physical deletion.

### 32.15 Migration Integrity

Migration implementation must verify that:

- migrations are version-controlled
- migrations execute deterministically
- a fresh database can be created from migration history
- PostGIS is enabled through migrations
- database constraints are created correctly
- indexes are created correctly
- booking concurrency constraints are created correctly
- migrations are tested in CI
- destructive migrations receive explicit review
- application/database compatibility is preserved

### 32.16 Production Data Integrity

Production must not contain fabricated operational data merely to make interfaces appear populated.

Production data must represent:

```text
real users
real facilities
real parking infrastructure
real reservations
real sessions
real payments
real occupancy
real operational history
```

where such data exists.

When no data exists, the application must display an honest empty state.

### 32.17 Cross-Client Integrity

The same backend state must be consumed consistently by:

```text
Consumer Web
Consumer Android
Operator Web
Staff Web
Admin Web
3D Digital Twin
```

A feature is not considered complete if it is functional in one client but disconnected from the shared backend state used by the other clients.

### 32.18 Realtime Integrity

Realtime implementation must verify that:

- relevant committed state changes produce appropriate events
- authorized clients receive relevant events
- duplicate events are handled safely
- delayed events do not corrupt client state
- missed events can be reconciled
- reconnecting clients can restore authoritative state
- realtime infrastructure does not become a second source of truth

### 32.19 Failure Integrity

Critical workflows must fail safely.

The system must distinguish between:

```text
loading
empty
unavailable
stale
error
success
```

The application must never convert a failure into an apparently successful business operation.

Examples:

```text
3D failure
    â‰ 
booking success

payment verification failure
    â‰ 
payment success

occupancy uncertainty
    â‰ 
VACANT

network failure
    â‰ 
request successfully completed
```

### 32.20 End-to-End Functional Integrity

Critical workflows must be tested across the complete architecture.

Representative booking workflow:

```text
User
   â†“
Web / Android / 3D
   â†“
API
   â†“
Authentication
   â†“
Authorization
   â†“
Validation
   â†“
Booking Service
   â†“
Database Transaction
   â†“
Concurrency Enforcement
   â†“
Booking State
   â†“
Realtime Event
   â†“
Other Clients
```

Representative occupancy workflow:

```text
Sensor / ANPR / Gate / Operator
            â†“
       IoT Ingestion
            â†“
        Validation
            â†“
      Occupancy Service
            â†“
        PostgreSQL
            â†“
       Realtime Event
            â†“
 Web / Android / Operator / 3D
```

Representative payment workflow:

```text
Client
   â†“
Backend
   â†“
Payment Provider
   â†“
Verified Provider Event
   â†“
Payment State
   â†“
Booking / Session Workflow
   â†“
Realtime / Client
```

### 32.21 Automated Test Requirements

Before implementation is considered complete, the repository must contain appropriate tests for:

```text
database constraints
foreign keys
unique constraints
booking concurrency
booking idempotency
hold expiration
parking sessions
occupancy processing
payment verification
payment webhook retries
audit behavior
spatial queries
3D mapping
realtime synchronization
IoT ingestion
AI/ML integration
authorization
```

### 32.22 Negative-Path Testing

The test suite must include failure scenarios such as:

```text
duplicate booking request
overlapping booking
expired hold
slot becomes unavailable
invalid vehicle eligibility
payment failure
duplicate payment webhook
invalid occupancy event
stale occupancy
sensor failure
invalid 3D mapping
missing 3D asset
realtime disconnection
backend timeout
unauthorized administrative action
```

The expected behavior must be explicitly defined and verified.

### 32.23 Build Verification

The repository must pass the applicable verification pipeline before the feature is considered complete.

At minimum:

```text
format check
lint
typecheck
build
unit tests
integration tests
end-to-end tests
database migration validation
```

The exact commands will be finalized as the application implementation develops.

### 32.24 CI Verification

CI must eventually verify the complete database and application contract.

Where the CI environment provides PostgreSQL, it should:

```text
start PostgreSQL
enable PostGIS
apply migrations
validate schema
run database tests
run concurrency tests
run integration tests
run application tests
```

A critical database or integration failure must prevent the relevant change from being considered complete.

### 32.25 Performance Verification

Performance validation must include appropriate measurements for:

```text
database queries
booking transactions
occupancy ingestion
realtime updates
spatial searches
3D loading
3D rendering
floor switching
API response times
```

Performance optimization must not weaken correctness or security.

### 32.26 Backup and Recovery Verification

Production readiness requires that:

- backups are configured
- retention is documented
- recovery objectives are documented
- restoration is tested
- PostGIS recovery is verified
- booking integrity after recovery is verified
- payment integrity after recovery is verified
- occupancy reconciliation is verified
- realtime recovery is verified
- 3D reconciliation is verified

### 32.27 Security Verification

Before production, the system must verify:

```text
database access controls
API authorization
realtime authorization
secret handling
SQL injection protections
credential isolation
backup protection
production network restrictions
```

Security verification must include both positive and negative authorization tests.

### 32.28 Documentation Integrity

The following documents must remain consistent:

```text
ADR 0001: System Architecture
ADR 0002: Database Architecture
Domain Model
Database Schema Specification
Database Migrations
API Contracts
3D Mapping Documentation
```

A change that materially alters the domain model or consistency guarantees must update the relevant documentation.

### 32.29 No Placeholder Functionality

The final implementation must not contain production-facing fake behavior such as:

```text
fake success messages
fake booking confirmations
fake payment success
hardcoded occupancy
fake analytics
non-functional buttons
mock database data presented as real data
placeholder production workflows
```

Temporary mocks may exist only in explicitly isolated development or test infrastructure.

### 32.30 Definition of Functional Completion

A feature is functionally complete only when:

```text
User Action
    â†“
Client
    â†“
API
    â†“
Backend Logic
    â†“
Database
    â†“
Authoritative State
    â†“
Realtime / Response
    â†“
Client Update
```

has been implemented and verified for that feature.

A user interface alone does not constitute a completed feature.

### 32.31 Cross-Platform Completion

For functionality intended to be shared across platforms:

```text
Web
Android
Operator
Staff
Admin
3D
```

the implementation must use consistent backend contracts.

Platform-specific presentation is allowed.

Platform-specific contradictory business logic is not.

### 32.32 Final Acceptance Principle

The ParkWise database and surrounding application architecture are considered correct only when every important piece has a clear purpose, a real implementation, an authoritative data source, and a verified connection to the rest of the system.

The final system must follow:

```text
Purpose
   â†“
Domain Model
   â†“
Database Contract
   â†“
Backend Implementation
   â†“
Client Implementation
   â†“
Integration
   â†“
Automated Verification
```

No feature should be considered complete merely because it is visible.

### 32.33 Final Definition of Done

The ParkWise database schema is considered ready for executable migration implementation when:

- the complete schema specification is documented
- the domain entities are clearly defined
- relationships are defined
- state boundaries are defined
- booking concurrency requirements are defined
- occupancy requirements are defined
- payment requirements are defined
- audit requirements are defined
- geospatial requirements are defined
- 3D requirements are defined
- IoT boundaries are defined
- AI/ML boundaries are defined
- migration requirements are defined
- production seed policy is defined
- security requirements are defined
- backup and recovery requirements are defined
- implementation boundaries are defined
- cross-client consistency requirements are defined
- critical invariants are testable
- the database can be implemented without inventing missing domain behavior

The next implementation phase must translate this specification into executable PostgreSQL and PostGIS migrations and then prove the resulting system through automated tests.
