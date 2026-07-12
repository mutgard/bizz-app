import re
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from config import get_pack
from models import Client, Appointment, Payment, Lead

router = APIRouter(tags=["todos"])

_AMOUNT_RE = re.compile(r"[€$]([\d.,]+)")


def _parse_payments(payments: list[Payment], paid_keyword: str) -> tuple[float, float]:
    """Mirror frontend/src/lib/clientHelpers.ts parsePayments: sum amounts found
    in each payment's `value` string; an amount counts toward `paid` when its
    row's value contains the pack's paidKeyword (case-insensitive)."""
    total = 0.0
    paid = 0.0
    for p in payments:
        m = _AMOUNT_RE.search(p.value)
        if not m:
            continue
        amount = float(m.group(1).replace(".", "").replace(",", "."))
        total += amount
        if paid_keyword in p.value.lower():
            paid += amount
    return total, paid


@router.get("/todos")
def list_todos(session: Session = Depends(get_session)):
    """Derived "Per fer" work queue — no dedicated table, computed on read.

    Rules (pack-agnostic):
    1. schedule_fitting — client with days_until in [0, 45], status not
       terminal, and zero Appointment rows. (Appointment.value is a free-form
       display string, not a parseable date in the current data model, so
       "no appointments scheduled" is approximated as "zero rows" rather than
       "no future-dated row". Appointment.time/outcome now give a precise
       "future-dated and not done/no_show" test — a future precision upgrade,
       not done here.)
    2. collect_deposit — client with parsed payments priceTotal > 0 and
       paid == 0, status not terminal.
    3. review_lead — one entry per Lead with status == "open"; client_id is
       None (leads aren't clients yet), client_name is the lead's name, and
       the lead id is carried in `detail`.

    Sorted: schedule_fitting (by days_until asc), then collect_deposit,
    then review_lead.
    """
    pack = get_pack()
    terminal_keys = {s["key"] for s in pack["statuses"]["client"] if s.get("terminal")}
    paid_keyword = pack["locale"]["paidKeyword"].lower()

    clients = session.exec(select(Client)).all()

    fitting_todos = []
    deposit_todos = []
    for c in clients:
        if c.status in terminal_keys:
            continue
        appointments = session.exec(select(Appointment).where(Appointment.client_id == c.id)).all()
        if 0 <= c.days_until <= 45 and not appointments:
            fitting_todos.append({
                "type": "schedule_fitting", "client_id": c.id, "client_name": c.name,
                "detail": "No appointment scheduled", "days_until": c.days_until,
            })
        payments = session.exec(select(Payment).where(Payment.client_id == c.id)).all()
        total, paid = _parse_payments(payments, paid_keyword)
        if total > 0 and paid == 0:
            deposit_todos.append({
                "type": "collect_deposit", "client_id": c.id, "client_name": c.name,
                "detail": "Deposit outstanding", "days_until": c.days_until,
            })

    fitting_todos.sort(key=lambda t: t["days_until"])

    leads = session.exec(select(Lead).where(Lead.status == "open")).all()
    lead_todos = [{
        "type": "review_lead", "client_id": None, "client_name": lead.name,
        "detail": f"lead:{lead.id}", "days_until": None,
    } for lead in leads]

    return fitting_todos + deposit_todos + lead_todos
