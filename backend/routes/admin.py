"""Operator backoffice API (Phase 1: in-tenant).

Token-protected endpoints exposing KPIs, captured errors, and the tenant
configuration. Auth: set env ADMIN_TOKEN on the instance; callers send it as
"X-Admin-Token: <token>" or "Authorization: Bearer <token>". These endpoints
double as the remote API a future central backoffice (Phase 2) pulls from.
"""
import os
import re
import sys
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from database import get_session, DATABASE_URL
from models import Client, Appointment, Payment
from config import get_pack, active_pack_id
import monitor

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(
    authorization: Optional[str] = Header(None),
    x_admin_token: Optional[str] = Header(None),
) -> None:
    expected = os.getenv("ADMIN_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Admin API disabled: ADMIN_TOKEN not configured")
    supplied = x_admin_token
    if not supplied and authorization and authorization.startswith("Bearer "):
        supplied = authorization[len("Bearer "):]
    if supplied != expected:
        raise HTTPException(status_code=401, detail="Invalid admin token")


_NUM = re.compile(r"(\d[\d.,]*)")


def _parse_amount(text: str) -> Optional[float]:
    """Parse the first monetary amount in a free-text payment value.
    Handles both '1.800' (ca-ES thousands dot) and plain '300'."""
    m = _NUM.search(text or "")
    if not m:
        return None
    raw = m.group(1).rstrip(".,")
    if "." in raw and "," in raw:
        # rightmost separator is the decimal one
        dec = "." if raw.rindex(".") > raw.rindex(",") else ","
        thou = "," if dec == "." else "."
        raw = raw.replace(thou, "").replace(dec, ".")
    elif "." in raw or "," in raw:
        sep = "." if "." in raw else ","
        head, _, tail = raw.rpartition(sep)
        if len(tail) == 3:  # e.g. 1.800 → thousands separator
            raw = head.replace(sep, "") + tail
        else:               # e.g. 48.5 → decimal
            raw = raw.replace(sep, ".") if sep == "," else raw
    try:
        return float(raw)
    except ValueError:
        return None


@router.get("/kpis", dependencies=[Depends(require_admin)])
def kpis(session: Session = Depends(get_session)):
    pack = get_pack()
    paid_kw = pack["locale"]["paidKeyword"].lower()

    clients = session.exec(select(Client)).all()
    by_status = {s["key"]: 0 for s in pack["statuses"]["client"]}
    for c in clients:
        by_status[c.status] = by_status.get(c.status, 0) + 1

    payments = session.exec(select(Payment)).all()
    total = paid = 0.0
    for p in payments:
        amt = _parse_amount(p.value)
        if amt is None:
            continue
        total += amt
        if paid_kw in (p.value or "").lower() or paid_kw in (p.label or "").lower():
            paid += amt

    today = datetime.date.today().isoformat()
    upcoming = session.exec(
        select(Appointment).where(Appointment.date.isnot(None), Appointment.date >= today)
    ).all()

    return {
        "pack": active_pack_id(),
        "clients_total": len(clients),
        "clients_by_status": by_status,
        "payments_count": len(payments),
        "revenue_total": total,
        "revenue_paid": paid,
        "revenue_outstanding": max(0.0, total - paid),
        "currency": pack["locale"]["currencySymbol"],
        "appointments_upcoming": len(upcoming),
        "uptime_seconds": monitor.uptime_seconds(),
    }


@router.get("/errors", dependencies=[Depends(require_admin)])
def errors():
    return {
        "uptime_seconds": monitor.uptime_seconds(),
        "count": len(monitor.list_errors()),
        "errors": monitor.list_errors(),
    }


@router.get("/config", dependencies=[Depends(require_admin)])
def tenant_config():
    return {
        "pack_id": active_pack_id(),
        "pack": get_pack(),
        "runtime": {
            "python": sys.version.split()[0],
            "database_url": DATABASE_URL,
            "uptime_seconds": monitor.uptime_seconds(),
            "backoffice_phase": "1 (in-tenant)",
        },
    }
