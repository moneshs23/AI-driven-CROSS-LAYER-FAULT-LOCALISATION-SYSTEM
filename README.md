# Tanfinet Fault Detection

This project is a complete full-stack application designed for network fault detection and analysis, containing:

1. **Frontend**: A React application built with Vite (`frontend`)
2. **Backend**: An ML-powered FastAPI server (`backend`)

## Project Structure

- `/frontend`: React (Vite) frontend application.
- `/backend`: Python FastAPI backend driving the ML diagnostics.
- `start.ps1`: A unified PowerShell script to launch both the frontend and backend simultaneously for local development.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)
- pip (Python package installer)

## Installation & Setup

### 1. Backend Setup (FastAPI & ML Engine)

1. Open your terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. (Optional but recommended) Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the required Python dependencies:
   ```bash
   pip install fastapi uvicorn pydantic pandas numpy torch lightning pytorch_forecasting scikit-learn
   ```

### 2. Frontend Setup (React/Vite)

1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install the necessary Node.js dependencies:
   ```bash
   npm install
   ```

## Running the Application Locally

### Option A: The Easy Way (Windows Only)

You can launch both the backend and frontend simultaneously using the provided startup script.
Simply open a PowerShell window in the root directory (where `start.ps1` is located) and run:

```powershell
.\start.ps1
```

### Option B: Manual Startup

If you prefer to run them separately or are not on Windows:

**1. Start the Backend:**

```bash
cd backend
python -m uvicorn api:app --reload --port 8000
```

_The backend will be available at `http://localhost:8000`._

**2. Start the Frontend:**
Open a second terminal window:

```bash
cd frontend
npm run dev
```

_The React app will be available at `http://localhost:3000`. API calls to `/api` are automatically proxied to the backend._
