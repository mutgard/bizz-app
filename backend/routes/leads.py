import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Lead, Appointment, Client
from schemas import LeadCreate, LeadPatch, LeadConvert
from routes.clients import _create_client, _serialize as _serialize_client

router = APIRouter(prefix="/leads", tags=["leads"])

def _serialize(lead: Lead) -> dict:
    return {
        "id": lead.id, "channel": lead.channel, "name": lead.name,
        "phone": lead.phone, "email": lead.email, "notes": lead.notes,
        "fields": lead.fields or {}, "status": lead.status,
        "created_at": lead.created_at,
        "converted_client_id": lead.converted_client_id,
    }

def _get_or_404(session: Session, lead_id: int) -> Lead:
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

def _digits(s: str) -> str:
    return "".join(ch for ch in s if ch.isdigit())

@router.get("")
def list_leads(status: str = "open", session: Session = Depends(get_session)):
    q = select(Lead)
    if status != "all":
        q = q.where(Lead.status == status)
    leads = session.exec(q).all()
    if status == "open":
        leads = sorted(leads, key=lambda l: l.created_at)
    else:
        leads = sorted(leads, key=lambda l: l.created_at, reverse=True)
    return [_serialize(l) for l in leads]

@router.get("/match")
def match_leads(phone: str = "", email: str = "", session: Session = Depends(get_session)):
    if not phone and not email:
        return []
    clients = session.exec(select(Client)).all()
    phone_digits = _digits(phone)[-9:] if _digits(phone) else ""
    email_lower = email.strip().lower()
    matches = []
    for c in clients:
        hit = False
        if email_lower and c.email and c.email.strip().lower() == email_lower:
            hit = True
        if not hit and phone_digits:
            client_digits = _digits(c.phone)[-9:] if _digits(c.phone) else ""
            if client_digits and client_digits == phone_digits:
                hit = True
        if hit:
            matches.append({"id": c.id, "name": c.name})
    return matches

@router.post("", status_code=201)
def create_lead(body: LeadCreate, session: Session = Depends(get_session)):
    lead = Lead(
        channel=body.channel, name=body.name, phone=body.phone,
        email=body.email, notes=body.notes, fields=body.fields or {},
        status="open",
        created_at=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    session.add(lead); session.commit(); session.refresh(lead)
    return _serialize(lead)

@router.patch("/{lead_id}")
def patch_lead(lead_id: int, body: LeadPatch, session: Session = Depends(get_session)):
    lead = _get_or_404(session, lead_id)
    for field, val in body.model_dump(exclude_unset=True).items():
        if field == "fields" and val is not None:
            lead.fields = {**(lead.fields or {}), **val}
        else:
            setattr(lead, field, val)
    session.add(lead); session.commit(); session.refresh(lead)
    return _serialize(lead)

@router.post("/{lead_id}/convert")
def convert_lead(lead_id: int, body: LeadConvert, session: Session = Depends(get_session)):
    lead = _get_or_404(session, lead_id)
    if lead.status == "converted":
        raise HTTPException(status_code=409, detail="Lead already converted")
    c = _create_client(body.client, session)
    if body.appointment is not None:
        appt = Appointment(
            client_id=c.id,
            label=body.appointment.title, value=body.appointment.date,
            date=body.appointment.date, title=body.appointment.title,
        )
        session.add(appt); session.commit()
    lead.status = "converted"
    lead.converted_client_id = c.id
    session.add(lead); session.commit(); session.refresh(lead)
    return {"client": _serialize_client(c, session), "lead": _serialize(lead)}
