# Module 4 — Solution Proposals & Evaluation API Documentation

Base URL: `{{baseUrl}}/api/proposals` (default `http://localhost:8000/api/proposals`)  
Authentication: `Authorization: Bearer <Firebase_ID_Token>` (verified on backend via Firebase Admin SDK + MongoDB `users` profile & `approval_status`).

---

## Roles & Access Control

| Role | Create/Edit/Submit/Withdraw/Reopen Proposals | View Review Queue / Review / Change Status | View Private Drafts & Draft Docs |
| --- | --- | --- | --- |
| `student` | Yes (own / verified Module 3 team) | No (`403`) | Own / verified team only |
| `citizen` | Yes (own / verified Module 3 team) | No (`403`) | Own / verified team only |
| `university` (approved) | Yes | Yes (cannot self-review or review own team) | Own / verified team only |
| `industry` (approved) | No (`403`) | Yes (cannot self-review or review own team) | No (`403`) |
| `admin` | Yes | Yes (cannot self-review) | All |
| Unapproved (`pending`/`rejected`) | No (`403`) | No (`403`) | No (`403`) |

---

## Status Workflow State Machine

```text
draft ──(POST /{id}/submit)──► submitted ──(POST /{id}/withdraw)──► withdrawn
                                   │                                     │
                                   │ (POST/PATCH /{id}/status            │ (POST /{id}/reopen)
                                   │  or final review submit)            ▼
                                   ▼                                   draft
                              under_review
                                   │
                    (requires >= 1 submitted review
                     + decision comment >= 5 chars)
                                   ├──► accepted (terminal)
                                   └──► rejected (terminal)
```

---

## Evaluation Rubric (Backend-Authoritative)

Each criterion is scored strictly from **1 to 10** (`maxTotalScore = 50`). Client-submitted `maxScore` and `label` values are ignored by the backend.

1. `innovation` — **Innovation and Originality** (1–10)
2. `feasibility` — **Feasibility** (1–10)
3. `technical_quality` — **Technical Quality** (1–10) *(alias `implementation_strategy` mapped automatically)*
4. `societal_impact` — **Societal Impact** (1–10)
5. `scalability` — **Sustainability and Scalability** (1–10)

---

## Endpoints Reference

### Metadata & Integrations
- `GET /api/proposals/dashboard-stats?scope=all|mine` — Real MongoDB KPIs, `myProposalsStats`, consistent `statusDistribution` (includes `withdrawn`), and `recentProposals`.
- `GET /api/proposals/rubric-criteria` (alias: `/meta/rubric`) — Returns the 5 backend-defined criteria (`minScore: 1`, `maxScore: 10`, `maxTotalScore: 50`).
- `GET /api/proposals/challenges/published` (alias: `/meta/challenges`) — Reads published challenges from Module 2 `db.challenges` (no hardcoded fake seeding).
- `GET /api/proposals/teams/my-teams` (alias: `/meta/my-teams`) — Reads current user's teams from Module 3 `db.teams` (supports MongoDB `ObjectId` & string IDs, enriched with `db.users` member details).

### Supporting Documents (Protected)
- `POST /api/proposals/upload-document` — `multipart/form-data` (`file`, `docType`). Validates extension, MIME type, non-empty, max 10 MB. Returns `{ docId, name, url, docType, sizeBytes }` where `url` is an absolute authenticated endpoint URL (`<origin>/api/proposals/documents/<docId>`).
- `GET /api/proposals/documents/{doc_id}` — Authenticated download endpoint enforcing draft/uploader/team ownership and `X-Content-Type-Options: nosniff`.

### Proposal CRUD & Lifecycle
- `POST /api/proposals` — Create draft (`submitImmediately: false`) or submit immediately (`submitImmediately: true`). Validates published challenge, URLs, and Module 3 team membership.
- `GET /api/proposals` — List authorized proposals with `search` (title / `PROP-...` / ObjectId / challenge / author), `status`, `challengeId`, `dateFrom`, `dateTo`, `sortBy` (`newest`, `oldest`, `score_desc`, `score_asc`, `updated`), `page`, `limit`.
- `GET /api/proposals/my` — List proposals authored by current user or their verified Module 3 teams.
- `GET /api/proposals/{proposal_id}` — Full proposal details, enriched `challenge` & `team`, permission-filtered `reviews` & `reviewHistory`, `statusHistory`, and UI `permissions`.
- `PUT /api/proposals/{proposal_id}` — Edit a `draft` proposal (author / verified team / admin only).
- `DELETE /api/proposals/{proposal_id}` — Delete a `draft` proposal (author / admin only).
- `POST /api/proposals/{proposal_id}/submit` — Validate mandatory fields + published challenge and transition `draft -> submitted`.
- `POST /api/proposals/{proposal_id}/withdraw` — Author transitions `submitted -> withdrawn` with reason.
- `POST /api/proposals/{proposal_id}/reopen` — Author explicitly transitions `withdrawn -> draft` before editing/resubmitting.

### Evaluation & Review Workflow
- `GET /api/proposals/review-queue` (alias: `/reviewer/queue`) — Approved reviewers/admins only. Excludes drafts, withdrawn proposals, and any proposal where reviewer is author or verified team member.
- `GET /api/proposals/{proposal_id}/reviews` — Get authorized reviews & `reviewSummary`.
- `POST /api/proposals/{proposal_id}/reviews` (alias: `/review`) — Save private review draft (`submitFinal: false` — does NOT alter proposal status) or submit official review (`submitFinal: true` — transitions `submitted -> under_review`, prevents duplicate final reviews with `409 Conflict`).
- `GET /api/proposals/{proposal_id}/review-history` (alias: `/reviews/history`) — Immutable evaluation audit history (draft events hidden from non-reviewers).
- `GET /api/proposals/{proposal_id}/status-history` — Chronological status transition audit log.
- `POST /api/proposals/{proposal_id}/status` (alias: `PATCH /api/proposals/{proposal_id}/status`) — Reviewer-controlled transitions (`submitted -> under_review`, `under_review -> accepted|rejected`). Requires >= 1 submitted review and comment >= 5 chars for accept/reject.

### Notifications & Real-Time WebSocket
- `GET /api/proposals/notifications` — Fetch current user's notifications.
- `PUT /api/proposals/notifications/{notification_id}/read` — Mark a notification as read (`404` if not found or not owned).
- `PUT /api/proposals/notifications/read-all` — Mark all unread notifications as read.
- `WS /api/proposals/ws/notifications?token=<Firebase_ID_Token>` — Real-time WebSocket notification push channel (also supports `Authorization: Bearer <token>` header; rejects invalid/missing tokens with code `1008`).

### Live Role Dashboards (MongoDB-Backed)
- `GET /api/dashboard/student` — Live `activeChallenges`, `teamProjects`, `proposalsSubmitted`, `totalMyProposals`, `acceptedProposals`, `pointsEarned`.
- `GET /api/dashboard/citizen` — Live citizen proposal & challenge counts.
- `GET /api/dashboard/university` / `GET /api/dashboard/industry` — Live `pendingReviewQueue`, `completedReviews`, `acceptedProposals`, `totalEvaluatableProposals`.
- `GET /api/dashboard/admin` — Live `totalUsers`, `pendingApprovals`, `totalProposals`, `submittedReviews`.

---

## MongoDB Collections Used
- `proposals` (Module 4)
- `proposal_reviews` (Module 4)
- `proposal_review_history` (Module 4)
- `proposal_status_history` (Module 4)
- `proposal_documents` (Module 4)
- `notifications` (Shared)
- `challenges` (Read-only integration with Module 2)
- `teams` (Read-only integration with Module 3)
- `users` (Read-only integration with Module 1)
