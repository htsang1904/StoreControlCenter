# Store Control Center - Python API

This backend is a modern refactor of the original Strapi v4 architecture, designed for high performance, scalability, and type safety using Python's modern async ecosystem.

## 🚀 Technology Stack
- **Web Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Async, OpenAPI auto-docs)
- **Language**: Python 3.12+
- **Database**: PostgreSQL
- **ORM**: [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/) (using asyncpg)
- **Migrations**: [Alembic](https://alembic.sqlalchemy.org/en/latest/)
- **Data Validation**: [Pydantic v2](https://docs.pydantic.dev/latest/)
- **Authentication**: JWT (JSON Web Tokens) with passlib/bcrypt

---

## 📂 Architecture Overview

The project follows Domain-Driven Design (DDD) principles to ensure separation of concerns:

```text
python-api/
├── alembic/              # Database migration scripts
├── app/
│   ├── api/              # API Routers (Controllers)
│   ├── core/             # Core configurations (Security, JWT, Settings)
│   ├── db/               # Database connection and session management
│   ├── models/           # SQLAlchemy Data Models (DB Schemas)
│   ├── schemas/          # Pydantic Schemas (Request/Response validation)
│   └── main.py           # FastAPI application entry point
├── alembic.ini           # Alembic configuration
└── requirements.txt      # Python dependencies
```

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- **Python 3.12+** installed on your machine.
- **PostgreSQL** running locally or via Docker.
  - Create a blank database: `store_control_center`
  - Default connection expects: `postgres://postgres:postgres@localhost:5432/store_control_center`
  - *(You can customize these in `.env`)*

### 2. Environment Setup
Navigate into the `python-api` folder and create a virtual environment:

```bash
cd python-api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install the required dependencies:
```bash
pip install -r requirements.txt
```

### 3. Database Migrations
Before running the server, you need to create the 14+ tables in your PostgreSQL database. Run Alembic migrations:

```bash
alembic upgrade head
```

### 4. Running the Server
Start the FastAPI application using Uvicorn:

```bash
uvicorn app.main:app --reload
```
*The `--reload` flag enables auto-reloading during development.*

---

## 🐳 Docker Compose (Run Everything At Once)
If you want to spin up the **Frontend (Vue)**, **Backend (FastAPI)**, and **Database (PostgreSQL)** all simultaneously without installing Node/Python manually, use the `docker-compose.yml` file in the root directory:

```bash
# Go to the root layout
cd ..

# Start the stack
docker-compose up --build -d
```

Once running:
- **Frontend** is available at: `http://localhost:5173`
- **Backend API & Docs** are at: `http://localhost:8000/docs`

**Note on Database setup in Docker:**
To apply migrations on the newly created Docker database, run:
```bash
docker exec -it store_control_center_backend alembic upgrade head
```

---

## 📖 API Documentation

FastAPI automatically generates interactive API documentation. Once the server is running, visit:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

You can use the Swagger UI to directly interact with the `/auth/local`, `/tickets`, and `/qc` endpoints.

---

## 🔗 Frontend Integration

The Vue frontend (`src/services/http.js` & `src/services/admin_service.js`) has been updated to expect flat, RESTful JSON responses rather than Strapi's layered nested format:
- **Old (Strapi):** `{"data": {"id": 1, "attributes": {"title": "X"}}}`
- **New (FastAPI):** `{"id": 1, "title": "X"}`

Ensure your frontend `.env` is updated:
```env
VITE_API_BASE_URL=http://localhost:8000
```
