# SocioSolve-AI 🌍

> **Societal Challenges Platform** – A collaborative platform for citizens, students, universities, industry partners, and administrators to identify, propose, and solve real-world societal problems.

---

## 📦 Module 1 – Authentication & User Management

**Developer:** Member 1  
**Stack:** Python · FastAPI · MongoDB Atlas · React · Vite · Tailwind CSS · JWT · RBAC

---

## 📦 Module 4 – Solution Proposals & Evaluation

**Developer:** Gudiya Kumari (Member 4)  
**Deliverable:** End-to-end solution proposal submission, draft management, structured rubric evaluation, and controlled status workflow (`Draft -> Submitted -> Under Review -> Accepted / Rejected`).

### Module 4 API Endpoints (`/api/proposals`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/dashboard-stats` | Proposal dashboard KPIs, status distribution & recent activity |
| GET | `/api/proposals` | Search, filter (status, challenge, date), sort & paginate proposals |
| GET | `/api/proposals/my` | Get current user's / team's proposals & drafts |
| GET | `/api/proposals/review-queue` | Get reviewable proposals for authorized reviewers & admins |
| GET | `/api/proposals/challenges/published` | List published societal challenges eligible for proposals |
| GET | `/api/proposals/rubric-criteria` | Get 5-criterion grading rubric configuration |
| POST | `/api/proposals` | Create a new proposal (Draft or immediate Submit) |
| GET | `/api/proposals/{id}` | Get full proposal details, evaluation scorecard & status history |
| PUT | `/api/proposals/{id}` | Update a draft proposal |
| DELETE | `/api/proposals/{id}` | Delete a draft proposal |
| POST | `/api/proposals/{id}/submit` | Validate & submit a draft proposal for evaluation |
| POST | `/api/proposals/{id}/withdraw` | Withdraw a submitted proposal before review decision |
| GET | `/api/proposals/{id}/reviews` | Get reviewer evaluations & aggregate rubric scores |
| POST | `/api/proposals/{id}/reviews` | Save review draft or submit official rubric evaluation |
| GET | `/api/proposals/{id}/status-history` | Get chronological status workflow audit trail |
| POST | `/api/proposals/{id}/status` | Transition status (`Under Review`, `Accepted`, `Rejected`) |
| POST | `/api/proposals/upload-document` | Upload supporting documents & implementation plans |

---

## 🗂️ Project Structure

```
SocioSolve-AI/
├── backend/          # FastAPI backend (Python)
│   ├── app/
│   │   ├── config/       # DB connection & settings
│   │   ├── models/       # MongoDB document models (user, proposal)
│   │   ├── schemas/      # Pydantic schemas (auth, profile, proposal)
│   │   ├── routes/       # API route handlers (auth, users, proposals)
│   │   ├── services/     # Business logic (auth, profile, proposal_service)
│   │   ├── middleware/   # Auth dependencies (JWT + RBAC)
│   │   └── utils/        # JWT & password helpers
│   ├── tests/            # Automated tests (Module 4 workflow tests)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/         # React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/        # Auth + Dashboards + Profile + Module 4 Proposals & Review Queue
│       ├── components/   # Layouts & Proposal status/stepper components
│       ├── context/      # AuthContext (global state)
│       ├── services/     # Axios API layer (api, authService, proposalService)
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

## 🔗 Auth & User API Endpoints

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
| Member 1 | **Authentication & User Management** |
| Member 2 | Challenge Management |
| Member 3 | Team Collaboration |
| Member 4 | **Solution Proposals & Evaluation (Gudiya Kumari)** |
| Member 5 | AI Recommendation |
| Member 6 | Industry & Admin |
