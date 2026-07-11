from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from typing import Optional
from database import get_session
from models import Appointment, Delivery, Client
from config import get_pack

router = APIRouter(prefix="/events", tags=["events"])

def _appt_to_event(a: Appointment, session: Session) -> dict:
    c = session.get(Client, a.client_id) if a.client_id else None
    return {
        "id": a.id, "type": "appointment",
        "date": a.date, "title": a.title or a.label,
        "client_id": a.client_id,
        "client_name": c.name if c else None,
        "order_id": a.order_id, "supplier": None, "received": None,
    }

def _delivery_to_event(d: Delivery, session: Session) -> dict:
    c = session.get(Client, d.client_id) if d.client_id else None
    return {
        "id": d.id, "type": "delivery",
        "date": d.expected_date, "title": d.description,
        "client_id": d.client_id,
        "client_name": c.name if c else None,
        "order_id": None, "supplier": d.supplier, "received": d.received,
    }

@router.get("")
def list_events(
    from_date: str = Query(alias="from"),
    to_date: str = Query("9999-12-31", alias="to"),
    client_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    results = []
    pack = get_pack()
    features = pack.get("features", {})

    appt_q = select(Appointment).where(
        Appointment.date.isnot(None),
        Appointment.date >= from_date,
        Appointment.date <= to_date,
    )
    if client_id is not None:
        appt_q = appt_q.where(Appointment.client_id == client_id)
    for a in session.exec(appt_q).all():
        results.append(_appt_to_event(a, session))

    if features.get("deliveries"):
        deliv_q = select(Delivery).where(
            Delivery.expected_date >= from_date,
            Delivery.expected_date <= to_date,
        )
        if client_id is not None:
            deliv_q = deliv_q.where(Delivery.client_id == client_id)
        for d in session.exec(deliv_q).all():
            results.append(_delivery_to_event(d, session))

    if features.get("keyDate"):
        key_date_label = pack.get("strings", {}).get("event.keyDate", "Boda")
        wedding_q = select(Client).where(Client.wedding_date_iso.isnot(None))
        if client_id is not None:
            wedding_q = wedding_q.where(Client.id == client_id)
        for c in session.exec(wedding_q).all():
            if from_date <= c.wedding_date_iso <= to_date:
                results.append({
                    "id": c.id, "type": "wedding",
                    "date": c.wedding_date_iso,
                    "title": f"{key_date_label} · {c.name}",
                    "client_id": c.id, "client_name": c.name,
                    "order_id": None, "supplier": None, "received": None,
                })

    results.sort(key=lambda e: e["date"])
    return results
