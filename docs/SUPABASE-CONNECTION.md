# Supabase Connection — Wichakan

Project URL: `https://itmgezrxnqttngsmgxlo.supabase.co`
Project: Wichakan, Tokyo (ap-northeast-1)

## Current state (2026-10-10)
- Core migrations `initial_core`, `registry_access`, `enrollment_history` applied.
- `restrict_enrollment_rpc_execute` and `lock_down_private_trigger_execution` applied.
- 16 application tables; row-level security enabled on all.
- No auth users, schools, school memberships or students at time of verification.
- Not deployed; runtime login and student CRUD remain untested.

## Set up application safely
1. Copy `.env.example` into `.env.local`. This file is gitignored.
2. Obtain **publishable key** from the Supabase Dashboard > Project Settings > API Keys. Paste only into local environment variables or the hosting provider's environment-variable settings.
3. Run `npm install && npm run lint && npm run build && npm run dev`.
4. Set the appropriate Supabase Auth site URL and redirect allowlist for your deployment.
5. Create a test staff account via Supabase Auth; create `profiles`, `schools`, `school_memberships` via restricted administrative workflow.
6. Login at `/login`, open `/students`, and test CRUD with **fictitious** student data. Verify teacher read-only and cross-school denial.
7. Do not store the secret/service-role key in the browser, NEXT_PUBLIC_ variable or public GitHub repository.

## Verification needed before production
- Integrate server-side auth checks and session handling.
- Automated cross-school permission tests and negative tests of RPC functions.
- Add complete audit logs for student profile edits and institutional controls for academic status transitions.
- Secure backup/restore drills, privacy impact review, rate limiting and monitoring.
- Lock dependency versions and commit package-lock.json after validated install.

## Security caveat
`public.change_student_enrollment` is callable by signed-in users by design but checks for registrar/admin school membership internally. This SECURITY DEFINER endpoint needs targeted penetration tests before production use. Several unused tables intentionally have no client RLS policies (deny-by-default).
