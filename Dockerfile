# ── Stage 1: Build React frontend ─────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /ui

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: FastAPI backend + bundled static files ────────────────────────
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/

# Copy the Vite production build into /app/static so FastAPI can serve it
COPY --from=frontend-build /ui/dist ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
