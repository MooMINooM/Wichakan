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

## Personnel roster and learning area

The personnel page uses a searchable roster, role/status filters and pagination, with an adjacent summary and inline editor. Account codes are the existing UUIDs (shortened for display, full value in the title/editor); the page does not invent T001-style staff numbers. Accounts with multiple roles appear once. Status means enabled/suspended school membership; no leave/attendance status is inferred.

`profiles.learning_area` is optional text (NULL or 1–150 characters), added by the `personnel_learning_area` migration. It is not used for authorization. Existing records remain unspecified until an administrator saves a learning area. `get-account` returns the field; `update-profile` optionally saves it and preserves the old value if omitted. `update-learning-area` supports saving this optional field after the existing staff-role grant workflow. These actions retain the same identity, active admin and same-school checks as the existing account actions.

The summary counts distinct staff and active teacher-role holders. Assigned/unassigned teacher counts use teaching assignments connected to classroom offerings in the selected academic year, not learning-area labels. A year selector is available in the desktop header and mobile summary. Duplicate assignments and additional staff roles do not inflate teacher counts. Assignment-read failures are displayed separately from the roster.

If the staff grant succeeds but the subsequent area/status save fails, the form reports partial completion and remains available for retry. Editing a person with multiple roles changes status only for the selected existing role.

Database verification confirmed that the new field is nullable, length constrained, and that profiles still has RLS enabled. Security advisors also report existing findings on intentionally closed tables and existing authenticated SECURITY DEFINER RPCs; this change does not add a table, policy or privileged SQL function. Advisor references: [closed-table policy check](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [SECURITY DEFINER RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [existing password-protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
