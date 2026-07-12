# Atelier App — Improvement Backlog

Mark each item `[x]` when the plan has been fully implemented and tested.

| # | Feature | Plan | Status |
|---|---------|------|--------|
| 1 | Client edit form | [plan](superpowers/plans/2026-04-22-client-edit-form.md) | [x] |
| 2 | Intake demo screen | [plan](superpowers/plans/2026-04-22-intake-demo-screen.md) | [x] |
| 3 | Payment CRUD | [plan](superpowers/plans/2026-04-22-payment-crud.md) | [x] |
| 4 | Outstanding payments screen | [plan](superpowers/plans/2026-04-22-outstanding-payments.md) | [x] |
| 5 | Client list enhancements | [plan](superpowers/plans/2026-04-22-client-list-enhancements.md) | [x] |
| 6 | Order status workflow UI | [plan](superpowers/plans/2026-04-22-order-status-workflow.md) | [x] |
| 7 | Day-plan schema groundwork (appointment time/outcome/booking context) | [plan](superpowers/plans/2026-07-11-day-plan-schema.md) | [x] |
| 8 | Day-plan drift UI on the redesigned Avui/Agenda (confirm/no-show actions with undo, per-client no-show trail via auto-notes, hourly week grid with slot booking) | design: artifact da78970c §1/3/5 | [x] |
| 9 | No-show fee proposal row in Fitxa payments ("€30 proposat · registrar/ometre" per unbilled no-show) — designed in artifact §3, implementation deferred | no plan yet | [ ] |
| 10 | Link affordance: distinct icon on clickable links (beyond obvious buttons) so tappable text is recognizable | [spec](superpowers/specs/2026-07-13-nav-affordance-chevron-design.md) | [x] |
| 11 | In-container scrolling wherever lists overflow, so the screen itself never scrolls. Audited 2026-07-13 — three offenders: (a) ProfileScreen activity feed (`ProfileScreen.tsx:498`) grows unbounded and pushes the add-note input off-screen — needs own `flex:1 overflow:auto` + pinned input; (b) TodayDeskScreen (`TodayDeskScreen.tsx:220`) scrolls as one block incl. stats strip — each column should scroll independently; (c) AdminPage (`AdminPage.tsx:233,251`) errors/users tables scroll the whole page — give each panel a fixed-height scroll box. All other screens (Clients, Caixa, Materials, Agenda, Inbox, NewClient, mobile Today) already follow the header-pinned + `flex:1 overflow:auto` pattern | no plan yet | [ ] |
| 12 | Agenda/calendar events show the client name as the primary label instead of the event title | no plan yet | [ ] |
| 13 | Color-code events by type so the type is recognizable at a glance (new client, regular appointment, stock intake/delivery, …) — design a legible palette + legend; today only a thin TYPE_BORDER accent exists | no plan yet | [ ] |
| 14 | Materials → supplier order draft: v1 generates a copyable text draft of the buying order per supplier (from the to-buy list, grouped by supplier); future versions send the order to the supplier by email automatically | no plan yet | [ ] |
