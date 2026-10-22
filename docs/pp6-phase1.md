PP6 review and print workflow: homeroom teachers review grade summaries before report generation.

The teacher sidebar's ห้องประจำชั้น entry opens `/teacher/pp6` directly and remains active on that route. This is the single homeroom workspace for class grade review, assessments, comments and individual/class PP6 printing, including incomplete reports. Dashboard room cards pass `?room=<classroom ID>` to open that assigned room. Only rooms present in the teacher's homeroom assignments can be selected; an absent or unauthorized room parameter falls back to an assigned room in the selected academic year, then the first assigned room.


## Print layout

The uploaded single-page A4 reference is reproduced with a vector layout in `pp6-report.tsx`: 595.28 × 841.89 coordinate space, header/emblem positions, seven subject columns, 24 body rows (including blank rows), the lower-left assessment summary and three signature blocks. TH Sarabun New regular/bold fonts and the supplied school emblem are hosted locally; font redistribution notices are included in `public/pp6`. Shared application table styles do not affect the printed document. The print preview is mounted directly under the body so navigation and hidden review UI do not introduce blank pages.

Each student gets a complete header and paper. More than 24 subjects continue onto another complete page, with no omitted subjects. Existing teacher comments remain separate: short comments occupy the free lower margin; long or multiline comments use bounded continuation pages without losing Thai combining marks. The unapproved-data notice appears in the preview toolbar, outside the reference paper. Actual scores/grades keep the existing primary annual and secondary semester rules; unknown results, earned weights and GPA remain blank/dashes rather than copying sample values. Credit weights use the same hours/40 convention as existing GPA calculations; ranking remains unfilled because the system does not calculate an approved class ranking. Class printing uses the entire enrolled roster even when a search hides some rows.

Verification: `node tests/pp6-print-summary.cjs` checks totals, missing/zero/special results, ordering and comment pagination. Mocked browser print checks cover one-page A4, seven students producing exactly seven pages, searched roster printing, 27 subjects on two pages, separate long comments, local fonts/emblem and no production writes. Printed PDF pages are rendered and compared to the reference's measured geometry.

To reproduce the browser print checks, build with the mock environment (`NEXT_PUBLIC_SUPABASE_URL=https://ux-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ux-test-public-key NEXT_PUBLIC_BASE_PATH=/Wichakan npm run build`) and run `node tests/pp6-print.browser.cjs` with Playwright and Chromium installed, or set `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE_PATH`. The test intercepts all backend requests, writes only temporary test PDFs, and never changes real student data.


## Shared report typography

PP5 and PP6 share `REPORT_TYPE` in `src/lib/report-typography.ts`: page titles 20 pt, section headings 16 pt, body/subject rows 14 pt, table headings/notes/page numbers 12 pt. PP6 retains the existing TH Sarabun New regular/bold family and the A4 reference geometry. SVG sizes map directly to print points; HTML continuation pages use equivalent point units. Inline comments use matching SVG-coordinate sizes and a 15-unit line height so three lines fit the reserved lower margin.

Browser regression checks assert the rendered font family, shared sizes in headers/tables, short-comment bounds, continuation-page sizes, single/class page counts and authenticated homeroom signature.
