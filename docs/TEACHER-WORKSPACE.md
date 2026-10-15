# Teacher dashboard and scorebook

Both routes use the shared Wichakan header, sidebar, font scale, colors and surfaces. The dashboard has year/term/subject filters, four summary cards, a subject table, homeroom cards and a progress/tasks panel. The scorebook has assigned-course filters, four disjoint student counters and a grouped annual score table with administrator-defined caps.

## Data and permissions

The shared loader checks an active teacher membership, chooses one authorized school, and reads only assigned offerings and assigned/homeroom classrooms. Stable pagination and ID batches cover large rosters and score sets. Missing student/course details and query failures are explicit errors. A URL offering ID must belong to the teacher's loaded assignments before an editor opens.

Dashboard rows group the same subject's assigned rooms within the selected year and opening term. Student cards count distinct students; progress counts student–offering slots. A course is complete only when every enrolled student's persisted score is complete, valid under the administrator's caps, or has a supported special result. Zero-student classes and missing/invalid configurations never appear complete. Deadlines, attendance and unsupported timetable/results modules are not fabricated.

## Scores and saves

The bulk `save_course_scores` RPC delegates each row to the existing authorized `save_student_course_score` function inside one database transaction. The old RPC remains compatible with older clients. There are six integer scores, ordered as coursework/midterm/final for term 1 and term 2. All six caps must be valid and sum to exactly 100. Blank is null, not zero; valid entered zero is included. Term/annual totals use only complete, valid numeric components. Grades retain the existing 0–4 scale (80/75/70/65/60/55/50 boundaries). ร and มส override the numeric grade without fabricating numeric totals.

“บันทึกคะแนนทั้งหมด” is the only save action. It submits all dirty rows in the selected class, including rows hidden by the status filter, in one RPC request. Incomplete rows may be saved; a row counts complete only when all six scores exist or a supported special result is present. This is not a publication/approval workflow.

Every changed row is validated before sending. The database rejects malformed or duplicate rows and checks every student's enrollment, course authorization and score caps through the existing function. Any row error rolls back the whole request. Success updates all local records together; failure preserves every draft for retry. Inputs and navigation are blocked during writes. Course selection, internal links, refresh/close and sign-out warn about unsaved edits. Browser history navigation is not replaced. Separate term-specific offerings retain separate annual score records, matching the existing backend.

The “บันทึกคะแนนแล้ว / ยังไม่ครบ / ร–มส” counters are disjoint: saved normal complete rows, all unsaved/incomplete rows, and saved special-result rows. Footer completeness includes both normal and special results. Dirty rows never count as saved.

## Verification

Run `node tests/teacher-scores.cjs` for exact-100 validation, correct arithmetic (47+45=92), grade boundaries, blank/zero distinction, invalid inputs, special results, year/term isolation, duplicate enrollment handling, missing configuration and empty classes. CI includes this suite with the existing coverage suites. Browser validation uses mocked teacher-scoped data and the real save payload; no production student scores are modified.

Bulk-save browser regression: build with `NEXT_PUBLIC_SUPABASE_URL=https://ux-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ux-test-public-key NEXT_PUBLIC_BASE_PATH=/Wichakan npm run build`, then run `node tests/teacher-score-bulk.browser.cjs` with Playwright/Chromium installed (or set `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE_PATH`). This mocks all backend requests and checks a two-student batch sends one request, hidden dirty rows are included, failure retains both rows, retry saves both, incomplete rows persist, and individual save buttons are absent.

The bulk migration follows `202610160001_student_course_scores.sql` in repository replay order; its deployed Supabase migration version is `20261015182958`.
