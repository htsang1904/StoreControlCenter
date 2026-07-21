# Python Backend Architecture & Guidelines

> **Target Audience:** Future AI Agents and Human Developers
> **Purpose:** Outline the core invariants, structure, and design patterns of the newly migrated Python backend.

## 1. System Overview
The backend now lives in `python-api/` and is the active API implementation for Store Control Center. It was migrated from Strapi v4 (Node.js) to a **Python + FastAPI + PostgreSQL** stack.

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
│   ├── admin/            # SQLAdmin views/auth, enabled only by env
│   ├── core/             # App Config (JWT, DB URL, password hashing)
│   ├── db/               # SQLAlchemy Engine & Postgres Connection
│   ├── models/           # SQLAlchemy Models (Database Tables)
│   ├── schemas/          # Pydantic Models (Req/Res Validation - "What the client sees/sends")
│   ├── services/         # Shared business logic and policy helpers
│   └── tests/            # Pytest coverage for contracts and policies
```

## 3. Key Invariants for Agents

When implementing features in this backend, strictly adhere to these rules:

1. **Async Everywhere**: Always use `async def` for route handlers. Database operations must use `await session.execute(...)` from SQLAlchemy 2.0. Do not use blocking synchronous Python code in the API layer.
2. **Flat JSON Format**: Unlike Strapi (which returned `{"data": {"id": 1, "attributes": {...}}`), this FastAPI application returns standard flat JSON (`{"id": 1, "title": "...", ...}`). **NEVER** wrap responses in `data/attributes` unless integrating with a legacy system that explicitly demands it.
3. **Pydantic for Validation**: Every API endpoint must have a clearly defined Pydantic request model (`XYZCreate`, `XYZUpdate`) and response model (`XYZResponse`) in `app/schemas/`.
4. **Authentication**: Endpoints should be guarded using the `current_user: CurrentUser` dependency from `app.api.deps`. It extracts the `Bearer <token>` from the header.
5. **Alembic Workflows**: If you modify `app/models/`, create or update an Alembic migration under `python-api/alembic/versions/` and run `alembic upgrade head`. Do not manually alter tables in Postgres.
6. **Route Prefixes**: Routers are mounted both at root (`/tickets`) and under `/api` (`/api/tickets`) for compatibility. Frontend normally uses the `/api/...` shape through `VITE_API_BASE_URL`.
7. **Admin Boundaries**: Admin-only APIs live under `/admin/*` and must call role/permission guards before mutating data.

## 4. Current Entities Migrated
The following domains have been fully mapped to SQLAlchemy:
* **Auth**: `User`, `Role`
* **Organization**: `Store`, `Department`, `UserInfo`
* **Ticketing**: `Ticket`, `TicketLog`
* **QC (Quality Control)**: `QCForm`, `QCFormVersion`, `QCCriterion`, `QCFormCriterion`, `QCSession`, `QCSessionItem`, `QCDraft`, `QCFinding`
* **System**: `Notification`, `NotificationSubscription`, `Permission`, role permission mappings

## 5. Validation

From the repo root:

```sh
./scripts/agent-check.sh backend
```

The backend branch currently compiles `python-api/app` with `python3 -m compileall`. For functional changes, also run targeted pytest tests from `python-api/`.
