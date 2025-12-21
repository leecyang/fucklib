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
