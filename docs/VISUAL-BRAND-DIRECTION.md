# Wichakan Visual Brand Direction

The shared interface follows the supplied “Quietly Professional” board: clear, trustworthy and simple. Apply these rules through the shared tokens in `src/app/globals.css` and reusable components rather than adding page-specific variations.

| Element | Standard |
| --- | --- |
| Primary / hover | `#2563EB` / `#1D4ED8` |
| Canvas / surface | `#F8FAFC` / white |
| Text / secondary | `#0F172A` / `#64748B` |
| Border | `#E2E8F0` |
| Success / warning / danger | `#16A34A` / `#D97706` / `#DC2626` |
| Thai and Latin font | Locally hosted Sarabun, regular 400 / semibold 600 / bold 700 |
| Page / section / subsection titles | 24 / 18 / 16 px, semibold |
| Body / caption / metric | 14 / 12 / 32 px |
| Panel / control radius | 12 / 10 px |
| Panel shadow | `0 4px 16px rgba(0,0,0,.08)` |
| Spacing | 8 px scale; 16 px gaps; 24 px desktop panels, 16 px mobile |
| Table headers | `#F1F5F9`, compact semibold labels |

Use `PageHeader`, `AcademicIcon`, `WichakanBrand`, `.ui-panel`, `.ui-primary` and `.ui-secondary`. Keep secondary explanations concise. Reserve semantic colors for status; status labels must also convey meaning in text. Dense score tables retain compact controls and internal horizontal scrolling. Mobile controls remain at least 44 px tall.

The PP6 report is a separate print document: its TH Sarabun fonts, A4 geometry, SVG template, emblem and student name formatting are preserved.

## Verification

Build with the test Supabase environment before running the mocked browser checks:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://ux-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ux-test-public-key NEXT_PUBLIC_BASE_PATH=/Wichakan npm run build
node tests/visual-brand.browser.cjs
node tests/pp6-print.browser.cjs
```

Browser checks accept `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE_PATH`. The brand suite checks 15 routes at 1440 px and 360 px, shared typography/palette, document overflow, mobile navigation and login. It intercepts backend reads and rejects writes. PP6 checks individual/class printing and overflow pagination separately.
