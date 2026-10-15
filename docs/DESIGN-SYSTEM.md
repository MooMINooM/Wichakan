# Wichakan interface

Use `PageHeader` for workspace page titles. It provides one responsive heading, hero height, background, and optional context/actions. Include a school name or selected year only when it helps orient the user. Keep metrics and working controls outside the hero.

Shared values live in `src/app/globals.css` under “Shared Wichakan workspace system”. Route styles should control layout rather than override these values.

| Element | Standard |
| --- | --- |
| Main title | 30px desktop / 26px mobile, weight 800 |
| Panel heading | 18px, weight 700 |
| Body / field / table | 14px / 13px / 13px |
| Hero | Minimum 124px desktop / 112px mobile; actions appear in a separate row |
| Panel | 16px radius, 20px padding / 16px mobile |
| Primary action | Blue `--ui-primary`, minimum 42px height, 9px radius |
| Input | Minimum 42px height, 9px radius |
| Sidebar | 220px desktop; drawer below 1024px |

Use `ui-panel`, `ui-primary`, and `ui-secondary` for new surfaces and actions. Existing academic panels use the same values. Compact table actions remain compact; checkboxes retain their native control layout. Green, amber, and red indicate status rather than separate page themes.

Keep labels, selected context, empty states, validation, failures, and destructive-action consequences. Remove repeated headings, English translations of Thai labels, obsolete version labels, promotional copy, and implementation notes. Explain complex operations at the point of use. Do not hide errors or authorization limits to shorten a page.

Validation: production static export and TypeScript checks; mocked browser checks on all 15 routes at 1448px and 390px (header sizes, panel geometry, control heights, sidebar selection, overflow), curriculum step navigation, and the staff save/reset/error-recovery regression flow. Production data was not modified.
