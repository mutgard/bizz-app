# Day-plan schema groundwork (appointment time + outcome + scheduling-app context)

> **Status: deferred — tackle after the Claude-design screen redesign.**
> Schema/API groundwork for a "Today" day-plan dashboard. Deliberately UI-free so it
> stays valid whatever the redesign produces. The dashboard UI itself (placement,
> now/next hero, drift chips, confirm/no-show interactions) is a separate, later
> piece whose decisions are pending the redesign (user: "wait" on no-show side
> effects).

## Why

The owner of a busy walk-in business wants to see the plan for the day — what should
be happening right now — and track drift from the plan: confirm events that happened
and mark "didn't show". Today's schema cannot support that:

- `Appointment` has a `date` (ISO day) but **no time-of-day** → "right now / next"
  cannot be computed.
- Appointments have **no outcome state** → confirm / no-show cannot be recorded.
  (Deliveries already have `received`; weddings need no outcome.)
- Appointments cannot carry **scheduling-app context** (event type, invitee answers,
  booking UID) — needed both for day-plan context and for the intake Phase-2
  bookings webhook (reschedule/cancel needs `external_ref` lookup).

## Changes

### 1. Model (`backend/models.py`)
`Appointment` gains:
```python
time: Optional[str] = None          # "HH:MM" 24h — optional; untimed events remain valid
duration_min: Optional[int] = None  # length; lets a dashboard compute "in progress now"
outcome: Optional[str] = None       # None/'' = pending · 'done' · 'no_show'
source: Optional[str] = None        # None/'manual' · 'booking' (open set: calendly/cal.com/…)
external_ref: Optional[str] = Field(default=None, index=True)  # scheduling-app booking UID
context: Optional[dict] = Field(default=None, sa_column=Column(JSON))
                                    # scheduling-app payload: event type, invitee answers, notes…
                                    # (same JSON-column pattern as Client.custom / Lead.fields)
```

### 2. Migration (`backend/database.py`)
`run_migrations()` entries: `("appointment","time","TEXT")`,
`("appointment","duration_min","INTEGER")`, `("appointment","outcome","TEXT")`,
`("appointment","source","TEXT")`, `("appointment","external_ref","TEXT")`,
`("appointment","context","JSON")`.

### 3. Schemas (`backend/schemas.py`)
- `AppointmentCreate`: add `time`, `duration_min`, `source`, `external_ref`,
  `context: dict = {}` (all optional/defaulted).
- `AppointmentPatch`: same as Optionals, plus `outcome`.
- Validators (module-level helper + `field_validator`, lead channel/status pattern):
  `outcome` in `{'', 'done', 'no_show'}` (None passes); `time` matches
  `^\d{2}:\d{2}$` when present (None/'' passes); `duration_min` positive when
  present; `source` stays an open string.
- PATCH `context` merges via fresh-dict spread (`clients.py`/`leads.py` precedent —
  SQLAlchemy JSON in-place mutation trap).

### 4. Routes (`backend/routes/appointments.py`, `backend/routes/events.py`)
- POST passes the new fields; PATCH generic setattr + special-case `context` merge.
- `_appt_to_event` emits `time`, `duration_min`, `outcome`, `source`, `context`;
  delivery/wedding event dicts emit them as `None` (uniform event shape).
- Final sort key `e["date"]` → `(e["date"], e.get("time") or "")` — day-ordering,
  untimed first.

### 5. Frontend type sync only (no UI)
- `types.ts`: `AtelierEvent` gains `time?/duration_min?/outcome?/source?/context?`;
  `AppointmentCreate` gains the create-side fields.
- `api.updateAppointment` body widened to `Partial<AppointmentCreate> & { outcome?: string }`.
- No component changes; build stays green.

### 6. Seeds (`backend/seed.py`)
Times on existing seeded appointments; per pack two appointments dated dynamically
`datetime.date.today().isoformat()` (one `outcome='done'`, one pending) so a future
dashboard always demos; one with booking provenance (`source='booking'`,
`external_ref`, small `context.answers`).

### 7. Tests (`backend/tests/test_appointments.py`, `test_events.py`)
- New-field round-trips; bare create stays backward compatible.
- PATCH outcome done/no_show 200; bogus 422; time '9:00' 422 / '09:00' 200;
  negative duration 422; context merge (not replace).
- `/events` includes new fields; same-day sort by time, untimed first.
- Booking-shaped create round-trips (Phase-2 webhook contract in miniature).

## Execution model (when unblocked)
One Sonnet agent implements, Opus reviews the diff, main session verifies
(`pytest` 61→67+, `npm run build`, Agenda/profile render unchanged, curl
`/events?from=today&to=today`) and commits.

## Also deferred (needs the redesign first, no plan yet)
The dashboard screen itself: placement + landing screen, now/next hero, out-of-sync
chips + confirm/no-show buttons, open-leads context, EventDialog time input,
no-show side effects, `today.*` pack strings, `today` feature flag.
