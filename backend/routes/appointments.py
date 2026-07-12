from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session
from database import get_session
from models import Appointment, Client
from schemas import AppointmentCreate, AppointmentPatch

router = APIRouter(prefix="/appointments", tags=["appointments"])

def _get_or_404(session: Session, appt_id: int) -> Appointment:
    a = session.get(Appointment, appt_id)
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return a

def _to_event(a: Appointment, session: Session) -> dict:
    c = session.get(Client, a.client_id) if a.client_id else None
    return {
        "id": a.id, "type": "appointment",
        "date": a.date, "title": a.title or a.label,
        "client_id": a.client_id,
        "client_name": c.name if c else None,
        "order_id": a.order_id, "supplier": None, "received": None,
        "time": a.time, "duration_min": a.duration_min,
        "outcome": a.outcome, "source": a.source, "context": a.context,
    }

@router.post("", status_code=201)
def create_appointment(body: AppointmentCreate, session: Session = Depends(get_session)):
    a = Appointment(
        client_id=body.client_id,
        label=body.title, value=body.date,   # keep legacy fields in sync
        date=body.date, title=body.title,
        order_id=body.order_id,
        time=body.time, duration_min=body.duration_min,
        source=body.source, external_ref=body.external_ref,
        context=body.context or {},
    )
    session.add(a); session.commit(); session.refresh(a)
    return _to_event(a, session)

@router.patch("/{appt_id}")
def update_appointment(appt_id: int, body: AppointmentPatch,
                       session: Session = Depends(get_session)):
    a = _get_or_404(session, appt_id)
    data = body.model_dump(exclude_unset=True)
    for field, val in data.items():
        if field == "context" and val is not None:
            # merge, assigning a fresh dict (SQLAlchemy JSON doesn't track in-place mutation)
            a.context = {**(a.context or {}), **val}
        else:
            setattr(a, field, val)
    if "title" in data:
        a.label = data["title"]
    if "date" in data:
        a.value = data["date"]
    session.add(a); session.commit(); session.refresh(a)
    return _to_event(a, session)

@router.delete("/{appt_id}", status_code=204)
def delete_appointment(appt_id: int, session: Session = Depends(get_session)):
    a = _get_or_404(session, appt_id)
    session.delete(a); session.commit()
    return Response(status_code=204)
