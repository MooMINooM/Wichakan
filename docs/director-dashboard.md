# Director overview

`/director` is a read-only overview for active directors and school administrators. The first version covers primary and secondary classes: year/semester/level filters, enrollment/room/offering/completed-room totals, five recording-progress summaries and a room table. The pending-only filter affects the table. Room details show both homeroom teachers, course teachers, missing counts and activity assessors. It makes no score, attendance, assessment, approval or LINE changes.

- Scores count enrolled students with three valid saved marks for the selected semester (or ร/มส), using the same helper as the teacher dashboard. Annual completion flags do not block semester progress. Different offerings are never merged.
- Traits/reading count only saved, valid arrays of 8/5 scores. Zero is recorded; displayed defaults on an unsaved teacher form do not count.
- Activities collapse repeated schedule slots and use annual period 0 for primary, selected semester for secondary. Pass and fail both count as recorded; pending/null do not. Either homeroom teacher may record an unassigned activity once, using the shared canonical result.
- Attendance counts recorded student–lesson cells up to the Bangkok date, according to current Mon–Fri timetable slots, term dates and enrollment start/end intervals. Missing records are not inferred as present. `course_attendance_slots` supplies the source offering and selected periods for integrated subjects. Raw host marks joined through those slots match effective attendance semantics. An invoker RPC materializes authorized rosters/slots once and aggregates all offerings, avoiding client downloads of attendance records.
- Missing dates/timetable/configuration/teachers and unconfigured activities are visible. Unknown attendance/activity coverage suppresses a misleading 100% headline and shows a setup note. Zero denominators display a dash; empty rooms cannot be complete. This is recording completeness, not pass rates or certification/print permission.

The loader paginates 500 rows and batches 100 IDs, requests minimal columns scoped to the authenticated school and selected period, and retains no old report when a request fails or filters change. Assessment pagination uses its composite offering/student key. Students' names are not fetched. Teacher names come only from active in-school memberships/profiles. Administrators can preview the page through the overview link on the workspace screen; other roles are stopped before report requests.

RLS adds SELECT-only policies for directors of the same school on scores, settings and course assessments. Existing write rules remain in force. The attendance RPC is SECURITY INVOKER with empty search path, denies anonymous users and checks the requested school/year/term against an active director/admin membership.

Verification:
- `node tests/director-overview.cjs` (CI): deduplicated rosters, semester score completion, zero assessments, activity grouping/periods, missing prerequisites and empty cohorts.
- `node tests/director-dashboard.browser.cjs`: director/admin access, 1,000+ scores, filters, drilldown, both homeroom teachers, annual activities, stale asynchronous responses, errors/retry, empty years, mobile layout and absence of write requests. Optional `DIRECTOR_REVIEW_PNG` captures an internal visual-review image.
- `tests/director-dashboard.sql`: transactional authenticated RLS checks, director reads, no new writes, aggregate bounds/scope and integrated attendance equivalence, plus inactive/foreign/anonymous denial. All fixture membership/assessment changes roll back; the query has a 10-second timeout.

Build browser fixtures using the mock Supabase URL/key and `/Wichakan` base path. No production student results are changed by these tests.
