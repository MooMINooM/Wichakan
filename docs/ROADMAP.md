# Wichakan v0.1 — Foundation

## Project principles

1. Keep student identity separate from year-specific enrollment.
2. Curriculum and course definitions must be versioned.
3. Permissions must be enforced in the database and server, not only in UI.
4. Academic grades and documents must retain audit history.
5. Never put production student data or service-role secrets in the public repository.

## v0.1 delivery checklist

- [x] Project scaffold and initial dashboard shell
- [x] Baseline schema for schools, years, terms, users, learners, guardians, classrooms, curricula, subjects, course offerings and assignments
- [ ] Create a Supabase project and safely configure environment variables
- [ ] Implement login/logout and user onboarding
- [ ] Implement server authorization and RLS verification tests
- [ ] Implement student registry CRUD and enrollment workflows
- [ ] Implement curriculum and course management interfaces
- [ ] Test migrations on isolated development database
- [ ] Add audit logging, backups and privacy controls before pilot

## Future phases

- v0.2: Academic setup and course registrations
- v0.3: Assessment and grade calculation engine
- v0.4: Review/approval and grade release
- v0.5: Official document templates and reporting

## Important caveats

The schema is a foundation, not a certified interpretation of Thai education rules. Curriculum criteria and official document templates require review by academic administrators. The repository has not been connected to a real database or deployed.
