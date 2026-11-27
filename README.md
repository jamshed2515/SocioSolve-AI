# SocioSolve-AI 🌍

> **Societal Challenges Platform** – A collaborative platform for citizens, students, universities, industry partners, and administrators to identify, propose, and solve real-world societal problems.

---

## 📦 Module 1 – Authentication & User Management

**Developer:** Member 1  
**Stack:** Python · FastAPI · MongoDB Atlas · React · Vite · Tailwind CSS · JWT · RBAC

---

## 📦 Module 3 – Team Formation & Collaboration

**Developer:** Member 3  
**Stack:** Python · FastAPI · Pydantic · MongoDB · React · Vite · Tailwind CSS · Socket.IO (python-socketio) · JWT / RBAC

Full lifecycle team formation, invitation workflows, join requests, threaded discussions with replies, task management boards with sprint progress, meeting scheduling with calendar sync, milestone tracking with linked tasks, persistent in-app notifications, and real-time Socket.IO collaboration.

### Module 3 API Endpoints

| Resource | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Teams** | POST | `/api/teams` | Create new innovation team (creator becomes leader) |
| | GET | `/api/teams` | Explore/search teams with filters (challenge, status, query) |
| | GET | `/api/teams/my` | Get teams user leads or belongs to |
| | GET | `/api/teams/{id}` | Get detailed team workspace & roster metadata |
| | PUT | `/api/teams/{id}` | Edit team mission, capacity, or details (leader only) |
| | DELETE | `/api/teams/{id}` | Disband/delete team (leader only) |
| **Join Requests** | POST | `/api/join-requests` | Submit application to join a recruiting team |
| | GET | `/api/join-requests/my` | View status of sent join requests |
| | DELETE | `/api/join-requests/{id}` | Cancel pending join request |
| | GET | `/api/teams/{id}/join-requests` | View received applications (leader only) |
| | PATCH | `/api/join-requests/{id}` | Accept or reject join request (leader only) |
| **Invitations** | POST | `/api/teams/{id}/invitations` | Invite platform user to team (leader only) |
| | GET | `/api/invitations/my` | View received team invitations |
| | GET | `/api/teams/{id}/invitations` | View pending invitations sent by team (leader only) |
| | PATCH | `/api/invitations/{id}` | Accept or reject received invitation |
| | DELETE | `/api/invitations/{id}` | Cancel pending invitation (leader only) |
| | GET | `/api/teams/{id}/members` | View sanitized member profiles & roles |
| | DELETE | `/api/teams/{id}/members/{user_id}` | Remove member from team (leader only) |
| | POST | `/api/teams/{id}/leave` | Voluntary member leave |
| | PATCH | `/api/teams/{id}/members/{user_id}/role` | Assign role (Co-Leader, Developer, etc.) |
| **Discussions** | POST | `/api/teams/{id}/discussions` | Create team discussion channel |
| | GET | `/api/teams/{id}/discussions` | List discussions with category & search filters |
| | GET | `/api/discussions/{id}` | Get discussion thread with replies |
| | PUT | `/api/discussions/{id}` | Edit discussion (author or leader) |
| | DELETE | `/api/discussions/{id}` | Delete discussion & cascade comments |
| | PATCH | `/api/discussions/{id}/pin` | Pin/unpin thread (leader only) |
| | PATCH | `/api/discussions/{id}/lock` | Lock/unlock thread (leader only) |
| **Comments** | POST | `/api/discussions/{id}/comments` | Post comment or nested reply |
| | PUT | `/api/comments/{id}` | Edit comment (author only) |
| | DELETE | `/api/comments/{id}` | Delete comment & replies (author/leader) |
| **Tasks** | POST | `/api/teams/{id}/tasks` | Create task and assign members (leader only) |
| | GET | `/api/teams/{id}/tasks` | List team tasks (filter by status/priority/assignee) |
| | GET | `/api/tasks/my` | Cross-team task dashboard for current user |
| | GET | `/api/tasks/{id}` | Get task details & assignee permissions |
| | PUT | `/api/tasks/{id}` | Edit task details & deadlines (leader/creator) |
| | PATCH | `/api/tasks/{id}/status` | Transition status (`todo` -> `in_progress` -> `review` -> `completed`) |
| | PATCH | `/api/tasks/{id}/progress` | Update completion percentage (0-100) |
| | PATCH | `/api/tasks/{id}/assign` | Reassign task members (leader only) |
| | DELETE | `/api/tasks/{id}` | Delete task permanently (leader/creator) |
| **Meetings** | POST | `/api/teams/{id}/meetings` | Schedule sync or mentor review (leader only) |
| | GET | `/api/teams/{id}/meetings` | List team meetings with upcoming/status filters |
| | GET | `/api/meetings/my` | Cross-team meeting agenda for current user |
| | GET | `/api/meetings/{id}` | Get meeting details, agenda & video link |
| | PUT | `/api/meetings/{id}` | Update meeting date, time or location (leader only) |
| | PATCH | `/api/meetings/{id}/cancel` | Cancel meeting with notification (leader only) |
| | DELETE | `/api/meetings/{id}` | Delete meeting permanently (leader only) |
| **Milestones** | POST | `/api/teams/{id}/milestones` | Create milestone linked to team tasks (leader only) |
| | GET | `/api/teams/{id}/milestones` | List team milestones with progress status |
| | GET | `/api/milestones/{id}` | Get milestone details & linked deliverables |
| | PUT | `/api/milestones/{id}` | Edit milestone target due date or description (leader only) |
| | PATCH | `/api/milestones/{id}/progress` | Update milestone completion progress (leader only) |
| | DELETE | `/api/milestones/{id}` | Delete milestone permanently (leader only) |
| **Notifications** | GET | `/api/notifications` | Paginated in-app persistent notifications |
| | GET | `/api/notifications/unread-count` | Unread badge count for header bell |
| | PATCH | `/api/notifications/read-all` | Mark all notifications as read |
| | PATCH | `/api/notifications/{id}/read` | Mark single notification as read |
| | DELETE | `/api/notifications/read` | Bulk clear read notifications |
| | DELETE | `/api/notifications/{id}` | Delete single notification |

### Real-Time Socket.IO Collaboration (`/socket.io`)
- **Connection Handshake**: Token authenticated via JWT query string or `auth: { token }`.
- **Private Room**: `user:{user_id}` receives live notifications (`notification:new`, `notification:read`, `notification:count_updated`).
- **Team Room**: `team:{team_id}` authorized to members only; broadcasts:
  - Discussions: `discussion:created`, `discussion:deleted`, `comment:created`, `comment:updated`, `comment:deleted`
  - Tasks: `task:created`, `task:updated`, `task:deleted`
  - Meetings: `meeting:scheduled`, `meeting:updated`, `meeting:cancelled`, `meeting:deleted`
  - Milestones: `milestone:created`, `milestone:updated`, `milestone:deleted`
- **Graceful Fallback**: If real-time disconnects, all operations persist via REST APIs.

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
| GET | `/api/proposals/meta/rubric` | Get 5-criterion grading rubric (20 pts each, total 100 pts) |
| GET | `/api/proposals/meta/challenges` | Get published challenges metadata |
| GET | `/api/proposals/meta/my-teams` | Get user's active collaborative teams |
| POST | `/api/proposals` | Create a new proposal (Draft or immediate Submit) |
| GET | `/api/proposals/{id}` | Get full proposal details, evaluation scorecard & status history |
| PUT | `/api/proposals/{id}` | Update a draft/withdrawn proposal (locks when accepted/rejected) |
| DELETE | `/api/proposals/{id}` | Delete a draft proposal |
| POST | `/api/proposals/{id}/submit` | Validate & submit a draft or withdrawn proposal |
| POST | `/api/proposals/{id}/withdraw` | Withdraw a submitted proposal for revisions |
| POST | `/api/proposals/{id}/review` | Submit reviewer evaluation with 100-pt rubric & recommendation |
| GET | `/api/proposals/{id}/review-history` | Get immutable historical audit log of all evaluation revisions |
| PATCH | `/api/proposals/{id}/status` | Transition status (`under_review`, `accepted`, `rejected`) |
| GET | `/api/proposals/{id}/status-history` | Get chronological status workflow audit trail |
| POST | `/api/proposals/upload-document` | Upload supporting documents & implementation plans |

### Module 4 Evaluation Rubric (100-Point Scale)

1. **Innovation & Originality** (Max: 20 points)
2. **Technical Feasibility** (Max: 20 points)
3. **Societal Impact** (Max: 20 points)
4. **Implementation Strategy** (Max: 20 points)
5. **Scalability & Sustainability** (Max: 20 points)
*Total Maximum Score: 100 points* | *Role restricted to:* `university`, `industry`, `admin`

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

> **New on the team?** Follow [LOCAL_SETUP.md](LOCAL_SETUP.md). It runs locally **without** the
> Firebase service-account key; you only need MongoDB.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # Works as-is with a local MongoDB
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
