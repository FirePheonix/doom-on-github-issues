# Supabase Integration

This app can use Supabase as its managed database without rewriting the runtime.

## Recommended Architecture

- **Supabase Postgres** for:
  - `issue_sessions`
  - `issue_session_events`
  - `issue_session_commands`
  - `issue_session_leases`
  - `issue_session_frames`
- **Existing S3 bucket** for rendered frame PNGs

This keeps the migration small:
- database moves to Supabase
- frame storage stays where it already works
- no deletion step is required

## Env

Set:

```env
DATABASE_URL=postgres://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-north-1
S3_BUCKET_NAME=vedaai-testing
S3_FOLDER_NAME=vedaai
```

Optional runtime flags:

```env
SESSION_REPOSITORY=postgres
SESSION_EVENT_REPOSITORY=postgres
SESSION_COMMAND_REPOSITORY=postgres
SESSION_LEASE_REPOSITORY=postgres
SESSION_FRAME_REPOSITORY=postgres
```

In practice, those repository flags are optional if `DATABASE_URL` is set, because the app already defaults to Postgres mode.

## Which Supabase connection string?

Use the connection string from the Supabase **Connect** dialog.

Guidance:
- for persistent app servers: use a direct or session-pooled connection string
- for short-lived/serverless compute: use a transaction-pooled connection string

This app is a persistent server process, so direct or session-pooled is the right default.

## Migrations

Run:

```bash
npm run db:migrate
```

That creates:
- `issue_sessions`
- `issue_session_events`
- `issue_session_commands`
- `issue_session_leases`
- `issue_session_frames`

## What does not need to change

- the Node runtime
- the `pg` driver
- the repository interfaces
- the webhook flow
- the S3 frame publishing path

## What I do not recommend yet

- moving frame PNGs to Supabase Storage immediately
- replacing the server-side `pg` path with Supabase client SDK calls
- mixing migration and deletion/cleanup in the same rollout

Move one boundary at a time:
1. Supabase DB
2. validate `/health`
3. validate `/debug/runtime`
4. validate `/debug/leases`
5. keep S3 untouched until the DB path is stable
