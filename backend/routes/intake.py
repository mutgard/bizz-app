from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
import json

from config import pack_dir
from database import get_session
from models import Lead

router = APIRouter(prefix="/clients", tags=["intake"])

@router.get("/{client_id}/intake")
def get_intake(client_id: int, session: Session = Depends(get_session)):
    path = pack_dir() / "intake" / f"client_{client_id}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    lead = session.exec(select(Lead).where(Lead.converted_client_id == client_id)).first()
    if lead:
        return {
            "source": "lead", "channel": lead.channel,
            "received_at": lead.created_at, "message": lead.notes,
            "fields": lead.fields or {}, "brief": None, "documents": [],
        }
    raise HTTPException(status_code=404, detail="No intake data for this client")
