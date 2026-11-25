# Run SocioSolve-AI on your laptop

This guide is for team members who cloned the repo and want the app running at
`http://localhost:5173`. **You do not need the Firebase service-account key** to run it.

## What you need

| Tool | Version | Check with |
|------|---------|------------|
| Python | 3.11 – 3.13 | `python --version` |
| Node.js | 20+ | `node --version` |
| MongoDB | any recent | see step 1 |

## 1. A database (pick one)

- **Local MongoDB** – install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and keep it running, **or**
- **Docker** – from the repo root run `docker compose up -d mongo`, **or**
- **Team Atlas cluster** – ask a teammate for the `MONGODB_URI` privately (never commit it) and put it in `backend/.env`.

## 2. Backend (terminal 1)

```powershell
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload
```

The copied `.env` works as-is for a local MongoDB. Open http://localhost:8000/docs to check it's up.

You will see this warning, and that's expected:

```
Firebase running in LIMITED local mode (key file not found ...). Sign-in works; ...
```

## 3. Frontend (terminal 2)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. No `frontend/.env` is needed: the public Firebase web config is
committed in `frontend/.env.development`, and the API defaults to `http://localhost:8000/api`.

## Limited mode vs. full mode

| Feature | Without key (limited) | With key (full) |
|---------|----------------------|-----------------|
| Register, log in (email & Google) | ✅ | ✅ |
| All dashboards, teams, proposals | ✅ | ✅ |
| Logout revokes sessions on other devices | ❌ (normal logout still works) | ✅ |
| Change password from the profile page | ❌ (use "Forgot password") | ✅ |
| Admin deactivating a user | ✅ blocked via database flag | ✅ + sessions revoked |

To switch to full mode, get the service-account key from a teammate **privately** and either:

- save it as `backend/secrets/firebase-service-account.json`, or
- put its JSON (raw or base64) in `FIREBASE_SERVICE_ACCOUNT_JSON=` in `backend/.env`.

Limited mode only works with `DEBUG=True`. A deployed server (`DEBUG=False`) refuses to start
without the key.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `MongoDB connection failed` / `ServerSelectionTimeoutError` | MongoDB isn't running, or `MONGODB_URI` is wrong (step 1). |
| `FIREBASE_SERVICE_ACCOUNT_PATH not found` | You have `DEBUG=False`. Set `DEBUG=True` in `backend/.env` for local work. |
| `Firebase: Error (auth/invalid-api-key)` in the browser | `frontend/.env.development` is missing – run `git pull`. |
| `Firebase: Error (auth/unauthorized-domain)` | Open the app at `http://localhost:5173`, not `127.0.0.1` or a LAN IP. |
| Browser shows CORS / network errors | Backend isn't running on port 8000, or `CORS_ORIGINS` doesn't include `http://localhost:5173`. |
| `Couldn't load your profile` after signing in | The backend can't be reached or MongoDB is down; check terminal 1. |
