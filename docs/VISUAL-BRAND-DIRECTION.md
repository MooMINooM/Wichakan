# Wichakan Visual Brand Direction

The current direction is “Open Academic Workspace”: academic, easy to use, blue and white, with open sections instead of nested rectangular cards. Shared tokens and presentation live in `src/app/academic-workspace.css`, loaded after legacy `globals.css` layouts. See `DESIGN-SYSTEM.md` for component guidance.

| Element | Standard |
| --- | --- |
| Primary / hover | `#2563EB` / `#1D4ED8` |
| Canvas / surface | white / white |
| Text / secondary | `#193656` / `#677D92` |
| Border | `#DCE7EF` |
| Success / warning / danger | `#16A34A` / `#D97706` / `#DC2626` |
| Thai and Latin font | Locally hosted Sarabun, regular 400 / semibold 600 / bold 700 |
| Page / section / subsection titles | 30 desktop (24 mobile) / 18 / 16 px |
| Body / caption / metric | 14 / 12 / 32 px |
| Panel / control radius | 0 / 7–8 px |
| Panel shadow | None; use dividers |
| Spacing | 32 px desktop page gutters; 16 px mobile; open sections with 20 px vertical padding |
| Table headers | `#EDF4FA`, compact semibold labels |

Use `PageHeader`, `AcademicIcon`, `WichakanBrand`, `.ui-panel`, `.ui-primary` and `.ui-secondary`. Keep secondary explanations concise. Reserve semantic colors for status; status labels must also convey meaning in text. Dense score tables retain compact controls and internal horizontal scrolling. Mobile controls remain at least 44 px tall.

The PP6 report is a separate print document: its TH Sarabun fonts, A4 geometry, SVG template, emblem and student name formatting are preserved.

## Verification

Build with the test Supabase environment before running the mocked browser checks:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://ux-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ux-test-public-key NEXT_PUBLIC_BASE_PATH=/Wichakan npm run build
node tests/visual-brand.browser.cjs
node tests/pp6-print.browser.cjs
```

Browser checks accept `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE_PATH`. The brand suite checks 20 routes at 1440 px and 360 px, shared typography/palette, document overflow, mobile navigation and login. It intercepts backend reads and rejects writes. PP6 checks individual/class printing and overflow pagination separately.
