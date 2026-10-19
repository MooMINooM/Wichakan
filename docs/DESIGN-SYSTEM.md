# Wichakan — Open Academic Workspace

The interface should feel like an academic working document: white space, blue ink, clear headings, restrained navigation and readable tables. Avoid nested cards, decorative hero panels and shadows. Shared presentation lives in `src/app/academic-workspace.css`, loaded after legacy route styles; route files retain their data and layout behavior.

| Element | Standard |
| --- | --- |
| Canvas | White; pale blue sidebar and filter strips |
| Text | Navy `#193656`, muted `#677d92`; local Sarabun font |
| Primary action | Blue `#2563eb`; one clear main action per task |
| Page title | Shared `PageHeader`, 30px desktop / 24px mobile, divider below |
| Sections | Open surfaces, 20px vertical padding, no perimeter border or shadow |
| Metrics | One divided strip; two columns on mobile where appropriate |
| Tables | Pale blue header, row dividers, subtle hover, opaque sticky columns |
| Controls | 7–8px radius; 44px touch actions on mobile |
| Navigation | Grouped labels, pale active row and blue indicator; drawer under 1024px |
| Dialogs | Keep a bounded surface and backdrop to distinguish the active task |

Use `ui-panel` for an open section and `ui-primary` / `ui-secondary` for actions. Do not remove form field boundaries, validation, disabled states, status colors, selection indicators or the timetable grid. Keep local overflow on wide tables. Never flatten the printed PP6 report into this screen design.

Workspace role selection uses readable rows instead of a card grid. The teacher navigation includes the existing timetable route. Page headers use the wordmark eyebrow instead of decorative school artwork. The skip link moves keyboard users past navigation.

Validation uses a production static export, TypeScript and existing domain checks, plus the mocked browser suite for populated desktop/mobile screens. Browser fixtures never write production data.
