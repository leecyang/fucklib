# FuckLib System

Library Automatic Reservation & Check-in System.

## Architecture

*   **Backend**: FastAPI (Python)
    *   REST API for User/Task management.
    *   APScheduler for background tasks (Reservation, Check-in).
    *   MySQL Database.
*   **Frontend**: React + Tailwind CSS
    *   Modern Dashboard.
    *   Login/Register with Invitation Code.
*   **Deployment**: Docker Compose

## Setup

1.  **Network**: Ensure `baota_net` network exists or let Docker create it.
    ```bash
    docker network create baota_net
    ```

2.  **Run**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Access**:
    *   Frontend: `http://localhost:3000` (or your server IP)
    *   Backend API: `http://localhost:8000`

## Initial Login

*   **Invite Code**: `ADMIN123` (Seeded on first run)
*   Register a new user using this code.

## Configuration

1.  **WeChat Cookie**:
    *   Go to **Settings**.
    *   Scan the QR code (you can generate one using the legacy `qr.png` logic or just copy the URL from WeChat).
    *   Paste the URL into the "Update Cookie" field.

2.  **Bluetooth Sign-in**:
    *   Go to **Settings**.
    *   Enter your Major and Minor values (get them using nRF Connect app).
    *   Paste the URL for Session ID.

## Features

*   **Multi-user**: Each user has their own configuration.
*   **Automatic Reservation**: Select seat and time.
*   **Automatic Check-in**: Bluetooth sign-in support.
*   **Status Monitoring**: View connection status and task logs.

## Deployment

This project supports **two deployment methods**:

### 1️⃣ Docker Compose (Traditional Server)

**Branches**: `main`, `release/v1.0`, `release/v2.0`

-   **Backend**: FastAPI with APScheduler (long-running tasks)
-   **Database**: MySQL (via Docker)
-   **Frontend**: React (built and served)
-   **Deployment**: SSH to server + `docker-compose up`

Automated deployment via GitHub Actions to private server (v2.0).

### 2️⃣ Vercel + Supabase (Serverless)

**Branch**: `deploy/vercel-supabase`

-   **Backend**: FastAPI as Vercel Serverless Functions (with `/api` prefix)
-   **Database**: Supabase PostgreSQL
-   **Frontend**: React (Vercel hosting)
-   **Deployment**: GitHub Actions → Vercel + Supabase
-   **Limitation**: Background scheduler disabled (Serverless restriction)

**Key Differences**:
-   All API routes use `/api` prefix for Vercel routing
-   Database uses `NullPool` for optimal serverless performance
-   Scheduled tasks should use external cron services (e.g., Vercel Cron)

See `.github/workflows/deploy-vercel-supabase.yml` for deployment workflow.

