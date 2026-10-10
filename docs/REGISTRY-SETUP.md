# Student Registry v0.2 Setup (development only)

1. Create a separate **development** Supabase project.
2. Copy `.env.example` to `.env.local` and supply project URL and publishable/anon key. Do NOT place the `service_role` key in NEXT_PUBLIC variables.
3. Run migrations `202610100001_initial_core.sql` then `202610100002_registry_access.sql` in a disposable development database.
4. Create a staff user in Supabase Auth with a verified email.
5. Through Supabase's protected SQL editor only, create a school, profile for the Auth UID, and school membership with role `school_admin` or `registrar`. These steps require privileged operator access; never build a public admin bootstrap endpoint.
6. Run `npm install`, `npm run lint`, `npm run build` and `npm run dev`. Visit `/login` then `/students`.
7. Test with another staff account in a different school. Verify no cross-school reads/writes and teacher read-only behavior. Do not use real student data before audit, privacy controls and comprehensive tests.

## Limitations
- Browser auth and RLS are present; advanced authorization and server-side route protection are still future work.
- Registrars can create/edit student identity; no year-specific enrollment form yet.
- No delete, import, change history, official record approvals, or production-grade audit.
- Do not treat this milestone as a deployed or verified production app.
