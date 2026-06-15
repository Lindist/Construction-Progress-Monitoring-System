# Construction Progress Monitoring System

Phase 1 foundation for uploading and previewing construction site videos/images.

## Frontend

```powershell
cd my-app
npm run dev
```

Open `http://localhost:3000`.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn main:app --reload
```

FastAPI runs at `http://localhost:8000`.

## PostgreSQL

```powershell
docker compose up -d postgres
```

The backend creates the `videos` table on startup.
