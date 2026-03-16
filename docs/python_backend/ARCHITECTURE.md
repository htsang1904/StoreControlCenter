# Python Backend Architecture & Guidelines

> **Target Audience:** Future AI Agents and Human Developers
> **Purpose:** Outline the core invariants, structure, and design patterns of the newly migrated Python backend.

## 1. System Overview
The backend was migrated from Strapi v4 (Node.js) to a pure **Python + FastAPI + PostgreSQL** stack to improve performance, async capability, and AI integration readiness.

* **API Layer**: `FastAPI` (Fully async)
* **Database**: `PostgreSQL`
* **ORM**: `SQLAlchemy 2.0 (asyncpg)`
* **Migrations**: `Alembic`
* **Validation**: `Pydantic v2`

## 2. Directory Structure (Domain-Driven Design)

The project lives in `/python-api`. All agents MUST follow this strict separation of concerns when adding new features:

```text
python-api/
├── alembic/              # Database migration scripts - DO NOT edit manually (use alembic cmds)
├── app/
│   ├── api/              
│   │   ├── routers/      # Controllers: FastAPI routing logic ONLY (No complex logic here)
│   │   └── deps.py       # FastAPI Dependencies (e.g. CurrentUser, get_db)
│   ├── core/             # App Config (JWT, DB URL, password hashing)
│   ├── db/               # SQLAlchemy Engine & Postgres Connection
│   ├── models/           # SQLAlchemy Models (Database Tables)
│   ├── schemas/          # Pydantic Models (Req/Res Validation - "What the client sees/sends")
│   └── services/         # (Future) Core Business Logic should live here
```

## 3. Key Invariants for Agents

When implementing features in this backend, strictly adhere to these rules:

1. **Async Everywhere**: Always use `async def` for route handlers. Database operations must use `await session.execute(...)` from SQLAlchemy 2.0. Do not use blocking synchronous Python code in the API layer.
2. **Flat JSON Format**: Unlike Strapi (which returned `{"data": {"id": 1, "attributes": {...}}`), this FastAPI application returns standard flat JSON (`{"id": 1, "title": "...", ...}`). **NEVER** wrap responses in `data/attributes` unless integrating with a legacy system that explicitly demands it.
3. **Pydantic for Validation**: Every API endpoint must have a clearly defined Pydantic request model (`XYZCreate`, `XYZUpdate`) and response model (`XYZResponse`) in `app/schemas/`.
4. **Authentication**: Endpoints should be guarded using the `current_user: CurrentUser` dependency from `app.api.deps`. It extracts the `Bearer <token>` from the header.
5. **Alembic Workflows**: If you modify `app/models/`, you **MUST** run `alembic revision --autogenerate -m "..."` followed by `alembic upgrade head`. Do not manually alter tables in Postgres.

## 4. Current Entities Migrated
The following domains have been fully mapped to SQLAlchemy:
* **Auth**: `User`, `Role`
* **Organization**: `Store`, `Department`, `UserInfo`
* **Ticketing**: `Ticket`, `TicketLog`
* **QC (Quality Control)**: `QCForm`, `QCFormVersion`, `QCCriterion`, `QCFormCriterion`, `QCSession`, `QCSessionItem`, `QCDraft`, `QCFinding`
* **System**: `Notification`
