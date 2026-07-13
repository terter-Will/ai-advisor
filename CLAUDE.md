# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AI Advisor is an internal tool with three parts:

- **`web/`** — Vue 3 + TypeScript + Vite SPA (the UI).
- **`api/`** — a single-file FastAPI backend (`api/main.py`) that talks to MariaDB (via `pymysql`) and, for SAP-related features, to SAP systems via RFC (`pyrfc`).
- **`infra/`** — `docker-compose.yml` + `init.sql` to run MariaDB locally for development.

Deployment is a simple SSH-based push to a single Ubuntu server, defined in `.github/workflows/deploy.yml`, triggered on every push to `main`.

## Commands

### Frontend (`web/`)

```
cd web
npm install
npm run dev       # Vite dev server (default http://localhost:5173)
npm run build     # vue-tsc -b (typecheck) && vite build -> web/dist
npm run preview   # preview the production build
```

There is no lint or test script configured for the frontend.

### Backend (`api/`)

No `requirements.txt` exists; dependencies are installed ad hoc (see `.github/workflows/deploy.yml`). Minimum runtime deps: `fastapi`, `uvicorn`, `pymysql`, `python-dotenv`. SAP RFC features additionally need `pyrfc` (a prebuilt wheel is checked into `api/pyrfc-3.3.1-cp311-cp311-win_amd64.whl` for Windows dev; it must be installed separately on the Linux deploy target and is optional — endpoints that use it fail gracefully with a 500 if it's not importable).

```
cd api
pip install fastapi uvicorn pymysql python-dotenv
uvicorn main:app --reload --port 8000
```

There is no automated test suite. `api/test_rfc.py` is a manual, standalone script for probing a live SAP RFC connection (not pytest-based) — run it directly with `python test_rfc.py` only when you need to debug SAP connectivity, and never commit real credentials into it.

### Local database (`infra/`)

Requires Docker Desktop to be running — start it manually first (Claude should not attempt to launch/wait on Docker Desktop itself; just ask the user to confirm it's running).

```
cd infra
docker compose up -d
```

Starts MariaDB on host port `3307` (container `3306`), auto-applying `init.sql` on first boot. Database name `ai_advisor`, user `admin`. Credentials are hardcoded in `docker-compose.yml` / `init.sql` for local dev only.

### Running the full stack locally

1. Start Docker Desktop manually (not automated — see above), then `cd infra && docker compose up -d`
2. `cd api && uvicorn main:app --reload --port 8000`
3. `cd web && npm run dev`

`web/.env.development` points `VITE_API_BASE` at `http://127.0.0.1:8000`; `web/.env.production` uses a blank base (same-origin), matching how the built frontend and API are deployed together behind one host.

## Architecture

### Backend (`api/main.py`)

Everything lives in one FastAPI file, organized by comment-delimited sections (`# ==================== ... ====================`). Key things to know before editing:

- **DB access pattern**: no ORM. `get_conn()` opens a raw `pymysql` connection per request (autocommit on by default; explicit `conn.begin()`/`commit()`/`rollback()` used for the multi-statement points operations). Queries are plain SQL strings with `%s` params.
- **Auth**: `/api/login` does a plaintext password comparison against `USRINFO.password` — there is no hashing or session/token issuance. The frontend just stores the returned user object in `localStorage` (see Frontend auth below). Treat this as a known limitation, not something to silently "fix" as a side effect of unrelated changes.
- **Users (`USRINFO` table)**: CRUD under `/api/users*`. Each user row carries both app fields (userid, password, role, points_balance) and a full set of SAP RFC connection fields (`sapaddr`, `sapins`, `sapclnt`, `sapusr`, `sappw`, etc.) — one user = one SAP connection profile.
- **SAP RFC integration** (`/api/users/{userid}/sap-read`, `/sap-ping`): pulls the target user's SAP fields from `USRINFO`, validates them via `_fetch_user_sap_params`, and opens a live `pyrfc.Connection` per request. `sap-read` calls `RFC_READ_TABLE` and parses its fixed-width/delimited output back into rows via `_parse_rfc_read_table`. `pyrfc` is imported lazily inside each endpoint so the rest of the API works even where the SAP SDK isn't installed.
- **Points ledger system**: `USRINFO.points_balance` is a running balance; every mutation also inserts an audit row into `points_ledger` (`kind` = CREDIT/DEBIT/REFUND) via `_insert_ledger`. Core logic is centralized in `_op_credit` / `_op_debit` / `_op_refund` / `_op_set_balance` (each wraps its update + ledger insert in one transaction) — route handlers are thin wrappers around these. The canonical routes are `/api/users/{userid}/points...`; `/api/points/{userid}/...` is a deprecated alias kept for backward compatibility and just delegates to the same functions. When adding a new points operation, add it to the `_op_*` layer and expose it from both route families only if the legacy alias is still meant to be supported.
- Endpoint bodies frequently accept several alternate field names for the same value (e.g. `amount`/`points`/`value`/`delta` in `PointsChange`, or `target_balance`/`target`/`balance` in `PointsSetBalance`) for compatibility with older frontend payloads — preserve this when touching these models rather than collapsing to a single field name.
- CORS origins come from `ALLOW_ORIGINS` env var (comma-separated), defaulting to local Vite dev ports.

### Frontend (`web/src/`)

- **Routing** (`src/router/index.ts`): role-gated routes under `/user/*` and `/admin/*`. No real auth token — `router.beforeEach` reads the logged-in user from `localStorage` key `aiadvisor_user` (set at login) and checks `route.meta.requiresAuth` / `route.meta.roles` against `user.role`. When adding a page, decide its role(s) and add the corresponding `meta` block; there's no shared layout guard beyond this.
- **Pages** (`src/pages/`) are one Vue file per feature/screen (e.g. `Admin.vue`, `User.vue`, `point_setting.vue`, `security_scan.vue`, `performance.vue`, `abap_test.vue`, `purchase_predict.vue`, `account_setting.vue`) — no nested feature folders.
- **Feature billing** (`src/composables/featureBilling.ts`): a shared reactive timer used by point-consuming features. `startBilling({userid, apiBase, label, perMinute})` starts a per-second timer that calls `POST /api/users/{userid}/points/adjust` (kind `DEBIT`) once per minute, then refreshes the balance and broadcasts it via a `window` `CustomEvent('points:updated')` so `TopBar.vue` (and anything else listening) can update the displayed balance without prop drilling. Any new points-metered feature page should reuse this composable rather than reimplementing timing/debit logic.
- API base URL comes from `import.meta.env.VITE_API_BASE` (see `.env.development` / `.env.production`).

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: builds `web/` with `npm run build`, then over SSH on the target server does a `git pull` in the API directory, reinstalls the (hardcoded) pip deps, restarts the `aiadvisor-api` systemd service, and separately SCPs `web/dist/*` into the web root. There is no staging environment or CI test gate — pushing to `main` deploys directly to production. The `infra/` MariaDB container is deployed and managed manually on the server (`/var/www/aiadvisor/infra`) — it is **not** touched by this workflow, so a `docker-compose.yml` change there requires a manual `docker compose up -d` on the server in addition to pushing.

Runs on a self-hosted runner (installed directly on the production host) rather than a GitHub-hosted one, because the deploy target sits on an internal-only IP (`172.16.188.175`) that GitHub-hosted runners can't reach.

**Commit message convention for changes meant to deploy**: keep it short — `YYMMDD <brief description>`, e.g. `260713 infra compose改寫`.
