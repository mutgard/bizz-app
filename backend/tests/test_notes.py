import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine, Session, SQLModel
from main import app
from database import get_session

@pytest.fixture(name="client")
def client_fixture(tmp_path):
    url = f"sqlite:///{tmp_path}/test.db"
    eng = create_engine(url)
    SQLModel.metadata.create_all(eng)
    def override():
        with Session(eng) as s:
            yield s
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()

def _make_client(client):
    r = client.post("/clients", json={
        "name": "Test", "wedding_date": "01 Jun 2026", "days_until": 43,
        "status": "clienta", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    return r.json()["id"]

def test_create_and_list_note(client):
    cid = _make_client(client)
    # Create three notes for the same client
    note1 = client.post("/notes", json={"client_id": cid, "text": "Truca: vol moure la prova"}).json()
    assert note1["text"].startswith("Truca")

    note2 = client.post("/notes", json={"client_id": cid, "text": "Second note"}).json()
    assert note2["text"] == "Second note"

    note3 = client.post("/notes", json={"client_id": cid, "text": "Third note"}).json()
    assert note3["text"] == "Third note"

    # Get all notes for the client
    r = client.get(f"/clients/{cid}/notes")
    assert r.status_code == 200
    notes = r.json()

    # Should have three notes, newest first (note3, note2, note1)
    assert len(notes) == 3
    assert notes[0]["id"] == note3["id"]  # Latest created should be first
    assert notes[1]["id"] == note2["id"]
    assert notes[2]["id"] == note1["id"]  # Earliest created should be last

def test_note_requires_existing_client(client):
    r = client.post("/notes", json={"client_id": 99999, "text": "x"})
    assert r.status_code == 404

def test_delete_note(client):
    cid = _make_client(client)
    nid = client.post("/notes", json={"client_id": cid, "text": "t"}).json()["id"]
    assert client.delete(f"/notes/{nid}").status_code == 204
