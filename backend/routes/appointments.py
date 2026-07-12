from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from database import get_session
from models import Appointment, Client, Note
from schemas import AppointmentCreate, AppointmentPatch
from config import get_pack

_NO_SHOW_NOTE_FALLBACK = "No-show · {title} · {date} {time}"

def _no_show_note_text(a: Appointment) -> str:
    tmpl = get_pack().get("strings", {}).get("note.noShowLog", _NO_SHOW_NOTE_FALLBACK)
    try:
        text = tmpl.format(title=a.title or a.label, date=a.date or "", time=a.time or "")
    except KeyError:
        text = _NO_SHOW_NOTE_FALLBACK.format(title=a.title or a.label, date=a.date or "", time=a.time or "")
    return text.strip()

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
    prev_outcome = a.outcome
    # Text is derived from pre-patch fields so a no_show -> other transition can
    # find and remove exactly the note the earlier no_show transition created.
    prev_note_text = _no_show_note_text(a) if a.client_id else None
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
    if "outcome" in data and a.client_id:
        if a.outcome == "no_show" and prev_outcome != "no_show":
            # Billable event: leave a durable trace in the client's activity log,
            # since tenants charge per no-show. Each fresh no_show transition logs
            # a note (no_show -> done -> no_show logs again); re-PATCHing an
            # already-no_show appointment does not duplicate it.
            session.add(Note(client_id=a.client_id, text=_no_show_note_text(a)))
        elif prev_outcome == "no_show" and a.outcome != "no_show" and prev_note_text:
            # Symmetric cleanup: undoing/correcting a no_show must not leave
            # billing evidence behind. Remove the newest matching auto-note.
            stale = session.exec(
                select(Note)
                .where(Note.client_id == a.client_id, Note.text == prev_note_text)
                .order_by(Note.id.desc())
            ).first()
            if stale:
                session.delete(stale)
    session.add(a); session.commit(); session.refresh(a)
    return _to_event(a, session)

@router.delete("/{appt_id}", status_code=204)
def delete_appointment(appt_id: int, session: Session = Depends(get_session)):
    a = _get_or_404(session, appt_id)
    session.delete(a); session.commit()
    return Response(status_code=204)
