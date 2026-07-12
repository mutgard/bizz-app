# Navigation affordance chevron — Design

**Date:** 2026-07-13
**Status:** Approved (backlog item #10 in docs/improvements.md)

## Goal

Clickable rows and cards that navigate somewhere currently signal tappability
only via `cursor: pointer`. Give them a visible affordance: a muted `›`
chevron. Obvious buttons/pills and text links that already carry `→` stay
untouched.

## Design

**Component.** `NavChevron` in `frontend/src/components/primitives.tsx`
(home of the existing shared primitives): a `<span aria-hidden>` rendering
the text glyph `›` — `color: T.ink3`, `fontSize: 15`, `lineHeight: 1`,
`flexShrink: 0`, `opacity: 0.7`. A text glyph, not a lucide icon: the app's
convention is text glyphs (`→ ← ×` throughout; lucide appears in 3 files
only), it inherits pack theming via `T`, and adds no imports.

**Placement.**
- Flex cards/rows: last flex child, `marginLeft: 'auto'` (or appended to the
  existing right-side slot), vertically centered.
- Desktop tables (clients, caixa): one extra trailing `<td>` (~24px) holding
  the chevron; matching empty `<th>` in the header row.
- The chevron renders **only when the element actually navigates**: today
  timeline rows only when they carry a `client_id`; inbox lead cards only
  when `status === 'open'`. The icon must never lie.

**Sites.**
1. `ClientsScreen` — desktop table rows + mobile cards
2. `CaixaScreen` — desktop rows + mobile cards
3. `TodayScreen` — urgent client card, timeline event rows (conditional),
   inbox teaser card, caixa summary card
4. `AgendaScreen` — all-day event rows (timed chips excluded: too dense,
   EventChip already carries type icons)
5. `InboxScreen` — lead cards (conditional on `open`)
6. `GlobalSearch` — result rows

**Not touched:** anything already carrying an affordance (`→` view-all
links, stat-tile go-links, `←` back buttons), buttons/pills, agenda timed
chips, TodayDeskScreen appointment rows (they expose an explicit "Perfil"
button).

## Verification

`npm run build` (typecheck) + `npx vitest run`; visual pass in the running
app on clients list, today screen, and inbox — confirm alignment and that
non-clickable variants show no chevron.
