# Teacher dashboard and scorebook

Both routes use the shared Wichakan header, sidebar, font scale, colors and surfaces. The dashboard has year/term/subject filters, four summary cards, a subject table, homeroom cards and a progress/tasks panel. The scorebook has assigned-course filters, four disjoint student counters and a grouped annual score table with administrator-defined caps.

## Data and permissions

The shared loader checks an active teacher membership, chooses one authorized school, and reads only assigned offerings and assigned/homeroom classrooms. Stable pagination and ID batches cover large rosters and score sets. Missing student/course details and query failures are explicit errors. A URL offering ID must belong to the teacher's loaded assignments before an editor opens.

Dashboard rows group the same subject's assigned rooms within the selected year and opening term. Student cards count distinct students; progress counts student–offering slots. A course is complete only when every enrolled student's persisted score is complete, valid under the administrator's caps, or has a supported special result. Zero-student classes and missing/invalid configurations never appear complete. Deadlines, attendance and unsupported timetable/results modules are not fabricated.

## Scores and saves

Keep the existing `save_student_course_score` RPC and database authorization. There are six integer scores, ordered as coursework/midterm/final for term 1 and term 2. All six caps must be valid and sum to exactly 100. Blank is null, not zero; valid entered zero is included. Term/annual totals use only complete, valid numeric components. Grades retain the existing 0–4 scale (80/75/70/65/60/55/50 boundaries). ร and มส override the numeric grade without fabricating numeric totals.

“บันทึกบางส่วน” saves dirty rows through the existing RPC, which marks a row complete when all six scores exist or a supported special result is present. “บันทึกคะแนน” first requires every student to have a complete row or special result. Individual dirty rows can also be saved. These are completeness controls, not a new publication/approval workflow.

Every changed row is validated before a batch starts. RPC writes remain per student; a batch is not transactional. Successful rows become clean, failed rows keep their values and error messages, and retry sends only dirty rows. Inputs and navigation are blocked during writes. Course selection, internal links, refresh/close and sign-out warn about unsaved edits. Browser history navigation is not replaced. Separate term-specific offerings retain separate annual score records, matching the existing backend.

The “บันทึกคะแนนแล้ว / ยังไม่ครบ / ร–มส” counters are disjoint: saved normal complete rows, all unsaved/incomplete rows, and saved special-result rows. Footer completeness includes both normal and special results. Dirty rows never count as saved.

## Verification

Run `node tests/teacher-scores.cjs` for exact-100 validation, correct arithmetic (47+45=92), grade boundaries, blank/zero distinction, invalid inputs, special results, year/term isolation, duplicate enrollment handling, missing configuration and empty classes. CI includes this suite with the existing coverage suites. Browser validation uses mocked teacher-scoped data and the real save payload; no production student scores are modified.
