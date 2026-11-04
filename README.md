# SocioSolve-AI 🌍

> **Societal Challenges Platform** – A collaborative platform for citizens, students, universities, industry partners, and administrators to identify, propose, and solve real-world societal problems.

---

## 📦 Module 1 – Authentication & User Management

**Developer:** Member 1  
**Stack:** Python · FastAPI · MongoDB Atlas · React · Vite · Tailwind CSS · JWT · RBAC

---

## 🗂️ Project Structure

```
SocioSolve-AI/
├── backend/          # FastAPI backend (Python)
│   ├── app/
│   │   ├── config/       # DB connection & settings
│   │   ├── models/       # MongoDB document models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Auth dependencies (JWT + RBAC)
│   │   └── utils/        # JWT & password helpers
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/         # React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/        # Auth pages + 5 dashboards + profile
│       ├── context/      # AuthContext (global state)
│       ├── services/     # Axios API layer
│       └── routes/       # Protected & role-based routes
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # Fill in your MongoDB Atlas URL & secrets
uvicorn app.main:app --reload
```

API Docs → http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App → http://localhost:5173

---

## 🔐 User Roles

| Role | Dashboard |
|------|-----------|
| Citizen | `/dashboard/citizen` |
| Student | `/dashboard/student` |
| University | `/dashboard/university` |
| Industry Partner | `/dashboard/industry` |
| Administrator | `/dashboard/admin` |

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login & get JWT |
| POST | `/api/auth/logout` | Logout & revoke token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/users/profile` | View profile |
| PUT | `/api/users/profile` | Update profile |
| PUT | `/api/users/change-password` | Change password |
| PUT | `/api/users/profile-image` | Upload avatar |

---

## 🤝 Integration for Other Modules

Import the shared auth dependency from `app.middleware.auth_middleware`:

```python
from app.middleware.auth_middleware import get_current_user, require_role
from app.models.user import UserRole

@router.get("/your-protected-route")
async def handler(user = Depends(require_role(UserRole.STUDENT))):
    user_id = str(user["_id"])
    user_role = user["role"]
    ...
```

---

## 🐳 Docker

```bash
# Copy and fill .env first
copy backend\.env.example backend\.env
docker-compose up --build
```

---

## 👥 Team

| Member | Module |
|--------|--------|
| Member 1 | **Authentication & User Management** ← *this repo* |
| Member 2 | Challenge Management |
| Member 3 | Team Collaboration |
| Member 4 | Solution Proposals |
| Member 5 | AI Recommendation |
| Member 6 | Industry & Admin |
