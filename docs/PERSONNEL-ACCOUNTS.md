# Personnel account actions

School administrators can edit a staff member's display name and login email or set a new password from `/personnel`. Staff retain the same Auth user ID and all existing memberships, homeroom assignments and teaching assignments. Multiple roles are grouped into one account card; role activation controls remain available per role.

## Backend

`supabase/functions/manage-staff` exposes `get-account`, `update-profile`, and `reset-password` through `supabase.functions.invoke`. It uses Supabase Auth's server-side admin API; no secret/service-role key is included in the website. Deploy with its `deno.json` import map. The project supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as Edge Function environment variables.

The gateway `verify_jwt` option is disabled to support modern signing keys. The handler **always** verifies the Bearer token via Auth `getUser` before accessing accounts, checks the actor's live active `school_admin` membership, and verifies the target's school membership. It refuses school-admin identities and accounts shared across schools. Requests cannot modify IDs, memberships, metadata or authorization claims.

Default browser origins are `https://moominoom.github.io`, `http://localhost:3000` and `http://127.0.0.1:3000`. Override `STAFF_ALLOWED_ORIGINS` with a comma-separated allowlist if hosting changes.

Password requests require at least 8 characters and at most 72 UTF-8 bytes. Password values are only passed to Auth and are never returned or written to profiles/logs. The client clears password state after success or closing the dialog. This action does not promise immediate invalidation of already-issued access tokens.

Login email changes apply directly through the admin API. Auth and profile edits are separate operations: if Auth succeeds but the profile write fails, the response explicitly reports that the email changed and asks the administrator to retry the name save. Failures keep the form open.

## Validation

- `npm run lint` and `npm run build`
- `node tests/manage-staff.cjs` checks authorization, tenant isolation, protected identities, input validation, identity-preserving mutations, failure handling and CORS with fake accounts.
- `deno check --node-modules-dir=manual --no-lock --config supabase/functions/manage-staff/deno.json supabase/functions/manage-staff/index.ts` checks the Edge Function when the exact SDK is installed locally; standard Deno resolution can also use the pinned npm import.
- Browser tests use mocked accounts for successful name/email/password mutations; production smoke tests only send unauthenticated or invalid-token requests. No real teacher's password is changed during verification.
