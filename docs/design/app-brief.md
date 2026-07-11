# Whitelabel Operations App — Design Brief

## What this project is

Design exploration for a **whitelabel operations app for solo craft/service businesses** (current verticals: a bridal atelier, a physiotherapy clinic). One deployment = one tenant = one "pack": a JSON config that drives branding, colors, fonts, strings, navigation, statuses, and per-vertical fields. The same React codebase renders "Juliette Atelier" (bridal, Catalan) or "Nordic Physio" (physio, Barcelona) purely from pack data.

The screenshots in `guidelines/screens/` show the **current live app** (atelier pack) at desktop (1440px) and mobile (390px). They are references for what exists — the starting point, not the target.

## The one goal

**Easy to use, easy to see, easy to navigate.** The user is a solo business owner (a dressmaker, a physiotherapist) — not a tech person, often on their phone between fittings/sessions. Every design decision should be judged by: can she find what she needs in one glance and reach it in one tap?

## What the app does (screens)

- **Clients** — list of active clients with status, key date (wedding), days remaining, materials, pending money. The home screen.
- **Client profile (Fitxa)** — status pipeline (prospect → sense paga → clienta → entregada), countdown to key date, payments, garment details, fabrics, events, intake data.
- **Fabrics (Teles)** — material inventory grouped by client or by fabric, with to-buy flags.
- **Shopping (Per comprar)** — aggregated shopping list grouped by supplier with cost totals.
- **Agenda** — monthly calendar with fittings/deliveries/weddings.
- **Intake (Ingrés)** — WhatsApp conversation → extracted brief → proposed client record (AI-assisted intake).
- **Finances** — invoiced/collected/pending totals and per-client payment progress.
- **/brief/{token}** — client-facing read-only page (the bride sees her own proposal). Public link, must feel like a boutique document.

## Current visual identity — KEEP

The paper/ink editorial aesthetic is loved and must stay recognizable per pack:
- Warm paper backgrounds (`#f6f1e7` family), dark ink (`#2b2118` family), muted accents (deep red `#7d2a33`-ish, gold `#c9a15a`-ish for atelier; teal `#0e7c86` for physio).
- Serif display type for headings/names, mono for labels/data, sans for body.
- Dark sidebar (desktop) / dark header + tab bar (mobile).
- All colors/fonts come from pack tokens — **designs must work when the palette and strings are swapped** (test mentally against the teal physio palette).

## Pain points to solve (owner's priorities)

**1. Hard to read / scan.**
- Tiny uppercase mono labels (10–11px) everywhere; secondary text is low-contrast ink on paper.
- Dense tables on desktop; on mobile, cards carry many small data points with equal visual weight — nothing pops as "the thing to look at".
- Status chips (PROSPECT / SENSE PAGA / CLIENTA / ENTREGADA) are subtle outline variations, hard to tell apart at a glance.
- The user should see *urgency* first: days-to-wedding, unpaid balances, things to buy. Today those sit visually equal with everything else.

**2. Hard to navigate.**
- On mobile the top tab bar **scrolls away with the content** — once you scroll, you can't switch sections without scrolling back up.
- Screens are not URL-addressable (state-only navigation): browser back doesn't work, nothing is deep-linkable except /brief and /admin.
- The status-advance button ("Avançar → Entregada") is a one-tap state change with **no confirmation and no undo**, placed where a scrolling thumb lands. Verified during this audit: one accidental tap silently advanced a client's status.
- Profile is reachable only through the list; cross-links (e.g. from a shopping item to its client, from an agenda event to the profile) are weak or missing.
- 7 nav sections is a lot for a phone tab bar; consider grouping (e.g. Teles + Per comprar are both "materials").

## What to explore in designs

1. **Mobile-first navigation**: persistent bottom tab bar (thumb-reachable) with ≤5 top-level destinations; sticky context header; clear back affordances.
2. **A "today" oriented home**: what needs attention now (upcoming fittings, overdue payments, materials to buy, weddings soon) before the full client list.
3. **Readability pass**: bigger base type, stronger hierarchy (one primary datum per row/card), status chips with unmistakable color/shape coding, urgency surfaced with the accent color only.
4. **Safe actions**: confirmations/undo for state changes; destructive/irreversible actions visually distinct and never in the scroll path.
5. **Desktop = receptionist workstation.** Used all day by reception staff, so the criterion is speed, not style: minimal but useful. Dense tables (~44px rows), global search always visible (⌘K, type-to-filter, phone number under the name for caller lookup), visible per-row actions, keyboard navigation (↑↓ + Enter to open a record), a system-generated "to do" queue (unscheduled fittings, unclaimed deposits), and a one-line interaction-log box always at hand. Brand lives only in the top bar and tokens; every other pixel is workspace.
6. Everything must remain **pack-driven**: no hardcoded brand colors or vertical-specific layout assumptions; labels come from strings, statuses/fields from pack config, so the physio pack renders equally well.

## Tech context (for feasibility)

React 19 + Vite + Tailwind 3 + Radix primitives (dialog, popover, alert-dialog), lucide icons. Currently no router library (an opportunity, not a constraint). FastAPI backend. Keep components simple and composable — this is a small codebase maintained by one developer with AI assistance.
