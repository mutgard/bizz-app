from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from database import get_session
from models import Client, Appointment, Payment, Fabric
from schemas import ClientCreate, ClientPatch

router = APIRouter(prefix="/clients", tags=["clients"])

def _get_or_404(session: Session, client_id: int) -> Client:
    c = session.get(Client, client_id)
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    return c

def _serialize(c: Client, session: Session) -> dict:
    appointments = session.exec(select(Appointment).where(Appointment.client_id == c.id)).all()
    payments = session.exec(select(Payment).where(Payment.client_id == c.id)).all()
    fabrics = session.exec(select(Fabric).where(Fabric.client_id == c.id)).all()
    return {
        "id": c.id, "name": c.name, "wedding_date": c.wedding_date,
        "days_until": c.days_until, "status": c.status, "garment": c.garment,
        "garment_style": c.garment_style, "measurements_date": c.measurements_date,
        "phone": c.phone, "email": c.email, "notes": c.notes,
        "wedding_date_iso": c.wedding_date_iso,
        "custom": c.custom or {},
        "appointments": [{"id": a.id, "label": a.label, "value": a.value} for a in appointments],
        "payments": [{"id": p.id, "label": p.label, "value": p.value} for p in payments],
        "fabrics": [{"id": f.id, "name": f.name, "use": f.use, "qty": f.qty,
                     "price": f.price, "to_buy": f.to_buy, "supplier": f.supplier}
                    for f in fabrics],
    }

@router.get("", response_model=list)
def list_clients(session: Session = Depends(get_session)):
    clients = session.exec(select(Client)).all()
    return [_serialize(c, session) for c in clients]

@router.post("", status_code=201)
def create_client(body: ClientCreate, session: Session = Depends(get_session)):
    c = Client(name=body.name, wedding_date=body.wedding_date,
               days_until=body.days_until, status=body.status,
               wedding_date_iso=body.wedding_date_iso,
               garment=body.garment, garment_style=body.garment_style,
               measurements_date=body.measurements_date,
               phone=body.phone, email=body.email, notes=body.notes,
               custom=body.custom or {})
    session.add(c); session.commit(); session.refresh(c)
    for a in body.appointments:
        session.add(Appointment(client_id=c.id, label=a.label, value=a.value))
    for p in body.payments:
        session.add(Payment(client_id=c.id, label=p.label, value=p.value))
    for f in body.fabrics:
        session.add(Fabric(client_id=c.id, name=f.name, use=f.use,
                           qty=f.qty, price=f.price, to_buy=f.to_buy,
                           supplier=f.supplier))
    session.commit(); session.refresh(c)
    return _serialize(c, session)

@router.get("/{client_id}")
def get_client(client_id: int, session: Session = Depends(get_session)):
    return _serialize(_get_or_404(session, client_id), session)

@router.patch("/{client_id}")
def patch_client(client_id: int, body: ClientPatch,
                 session: Session = Depends(get_session)):
    c = _get_or_404(session, client_id)
    for field, val in body.model_dump(exclude_unset=True).items():
        if field == "custom" and val is not None:
            # merge, assigning a fresh dict (SQLAlchemy JSON doesn't track in-place mutation)
            c.custom = {**(c.custom or {}), **val}
        else:
            setattr(c, field, val)
    session.add(c); session.commit(); session.refresh(c)
    return _serialize(c, session)

@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, session: Session = Depends(get_session)):
    c = _get_or_404(session, client_id)
    # cascade delete related records
    for model, fk in [(Appointment, Appointment.client_id), (Payment, Payment.client_id), (Fabric, Fabric.client_id)]:
        for row in session.exec(select(model).where(fk == c.id)).all():
            session.delete(row)
    session.delete(c); session.commit()
    return Response(status_code=204)
