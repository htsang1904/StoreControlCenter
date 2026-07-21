# Store Control Center

Internal operations app for store ticket handling, QC sessions, store/admin management, notifications, and dashboard reporting.

## Quick Start

### Prerequisites

- Node `20.19+` or `22.12+`
- Python `3.12+`
- PostgreSQL `15+`

Check local versions before validating changes:

```sh
node -v
npm -v
```

If Node is not compatible, prefer:

```sh
nvm use 20
```

### Frontend

```sh
npm install
npm run dev
```

The Vite app runs on `http://localhost:5173` by default.

### Backend

```sh
cd python-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

FastAPI docs are available at:

- `http://localhost:8001/docs`
- `http://localhost:8001/redoc`

### Docker

Run frontend, FastAPI backend, and PostgreSQL together:

```sh
docker-compose up --build
```

Default service ports:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8001`
- Backend docs: `http://localhost:8001/docs`

## Project Map

- Frontend app: `src/`
- Frontend routes: `src/router/index.js`
- Frontend API client: `src/services/http.js`
- Backend API: `python-api/app/api/routers/`
- Backend services: `python-api/app/services/`
- Backend models: `python-api/app/models/`
- Backend schemas: `python-api/app/schemas/`
- Migrations: `python-api/alembic/versions/`
- Agent workflow: `AGENTS.md`

## Main Features

- Dashboard summaries for tickets and QC.
- Ticket management, inbox, detail, replies, assignment, status transitions, attachment upload, realtime events, and OneSignal push notifications.
- QC management, store detail, draft/session creation, QC form administration, versioning, weighted pass/fail criteria, point criteria, and percentage deduction criteria.
- Admin tools for users, stores, store sync, departments, permissions, and QC forms.
- Suite SSO callback flow.

## Configuration

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:8001
VITE_AUTH_URL=
VITE_APP_VERSION=
VITE_DEFAULT_STORE_ID=
VITE_DEFAULT_STORE_NAME=
VITE_ONESIGNAL_APP_ID=
```

Backend `python-api/.env`:

```env
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=store_control_center
POSTGRES_PORT=5432
SECRET_KEY=change-this-to-at-least-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ALLOWED_ORIGINS=http://localhost:5173
CORS_ALLOW_CREDENTIALS=true
```

Optional backend integrations:

```env
SUITE_API=https://lab-sapi.guta.asia
SUITE_WEB_URL=https://suite.guta.vn
SUITE_PLATFORM_TOKEN=
MAIN_STORE_SYNC_URL=https://gapi.guta.asia/webapi/stores?all_stores=true
SUITE_VERIFY_TOKEN=false
SUITE_PUBLIC_KEY_FILE=

ENABLE_SQLADMIN=false
SQLADMIN_USERNAME=
SQLADMIN_PASSWORD=
SQLADMIN_SESSION_SECRET=

ENABLE_BOOTSTRAP_ADMIN=true
BOOTSTRAP_ADMIN_EMAIL=admin@storecontrol.local
BOOTSTRAP_ADMIN_NAME=System Administrator
BOOTSTRAP_ADMIN_PHONE_NUMBER=

APP_PUBLIC_URL=
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
ONESIGNAL_API_URL=https://api.onesignal.com/notifications
```

## Validation

Use the repo validation wrapper:

```sh
./scripts/agent-check.sh auto
```

Other scopes:

```sh
./scripts/agent-check.sh frontend
./scripts/agent-check.sh backend
./scripts/agent-check.sh all
```

Frontend validation runs the responsive breakpoint guard and `npm run build`.
Backend validation compiles `python-api/app` with Python syntax checks.

## OneSignal Web Push

Frontend registers the browser device and maps `external_id` to the logged-in user ID. Backend sends push notifications using the same `external_id`; the OneSignal REST API key must stay backend-only.

Ticket events currently emit in-app notification, realtime events, and OneSignal push for creation, replies, assignment, claiming, status changes, resolve, reopen, and rejection.

The service worker file must be served from the site root at `/OneSignalSDKWorker.js`. The OneSignal Dashboard web origin must match the deployed frontend origin.

## Docs

- Backend architecture: `docs/python_backend/ARCHITECTURE.md`
- Business flows: `docs/python_backend/BUSINESS_FLOWS.md`
- Ticket management report: `docs/ticket-management-report.md`
- QC form scoring: `docs/QC_FORM_SCORING_V2.md`
- QC form creation workflow: `docs/qc-form-creation-workflow.md`
