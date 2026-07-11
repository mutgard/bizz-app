from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from database import get_session
from models import Note, Client
from pydantic import BaseModel

router = APIRouter(tags=["notes"])

class NoteCreate(BaseModel):
    client_id: int
    text: str

def _serialize(n: Note) -> dict:
    return {"id": n.id, "client_id": n.client_id, "ts": n.ts, "text": n.text}

def _get_or_404(session: Session, note_id: int) -> Note:
    n = session.get(Note, note_id)
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    return n

@router.post("/notes", status_code=201)
def create_note(body: NoteCreate, session: Session = Depends(get_session)):
    if not session.get(Client, body.client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    n = Note(client_id=body.client_id, text=body.text)
    session.add(n); session.commit(); session.refresh(n)
    return _serialize(n)

@router.get("/clients/{client_id}/notes")
def list_notes(client_id: int, session: Session = Depends(get_session)):
    notes = session.exec(
        select(Note).where(Note.client_id == client_id).order_by(Note.ts.desc()).order_by(Note.id.desc())
    ).all()
    return [_serialize(n) for n in notes]

@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, session: Session = Depends(get_session)):
    n = _get_or_404(session, note_id)
    session.delete(n); session.commit()
    return Response(status_code=204)
