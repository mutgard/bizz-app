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

def _client_payload(name="New Client", phone="", email=""):
    return {
        "name": name, "status": "prospect", "phone": phone, "email": email,
        "custom": {}, "appointments": [], "payments": [], "fabrics": [],
    }

def test_create_lead_defaults(client):
    r = client.post("/leads", json={"channel": "whatsapp"})
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "open"
    assert data["created_at"]
    assert data["fields"] == {}

def test_create_lead_invalid_channel_rejected(client):
    r = client.post("/leads", json={"channel": "carrier-pigeon"})
    assert r.status_code == 422

def test_list_leads_default_open_oldest_first(client):
    r1 = client.post("/leads", json={"channel": "phone", "name": "First"})
    r2 = client.post("/leads", json={"channel": "email", "name": "Second"})
    dismissed_id = client.post("/leads", json={"channel": "walkin", "name": "Dismissed"}).json()["id"]
    client.patch(f"/leads/{dismissed_id}", json={"status": "dismissed"})

    r = client.get("/leads")
    assert r.status_code == 200
    data = r.json()
    names = [l["name"] for l in data]
    assert "Dismissed" not in names
    assert names.index("First") < names.index("Second")

    r_all = client.get("/leads?status=all")
    assert len(r_all.json()) == 3

def test_patch_dismiss_and_restore(client):
    lid = client.post("/leads", json={"channel": "phone", "name": "Toggle"}).json()["id"]
    r = client.patch(f"/leads/{lid}", json={"status": "dismissed"})
    assert r.status_code == 200
    assert r.json()["status"] == "dismissed"
    open_leads = client.get("/leads").json()
    assert all(l["id"] != lid for l in open_leads)

    r2 = client.patch(f"/leads/{lid}", json={"status": "open"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "open"
    open_leads2 = client.get("/leads").json()
    assert any(l["id"] == lid for l in open_leads2)

def test_patch_merges_fields(client):
    lid = client.post("/leads", json={
        "channel": "whatsapp", "fields": {"garment": "Vestit a mida"},
    }).json()["id"]
    r = client.patch(f"/leads/{lid}", json={"fields": {"garment_style": "Boho"}})
    assert r.status_code == 200
    assert r.json()["fields"] == {"garment": "Vestit a mida", "garment_style": "Boho"}

def test_convert_lead_creates_client_and_appointment(client):
    lid = client.post("/leads", json={"channel": "whatsapp", "name": "Aina"}).json()["id"]
    body = {
        "client": _client_payload("Aina Puig"),
        "appointment": {"title": "Consulta inicial", "date": "2026-08-01"},
    }
    r = client.post(f"/leads/{lid}/convert", json=body)
    assert r.status_code == 200
    data = r.json()
    cid = data["client"]["id"]
    assert data["client"]["name"] == "Aina Puig"
    assert data["lead"]["status"] == "converted"
    assert data["lead"]["converted_client_id"] == cid

    r2 = client.get(f"/clients/{cid}")
    assert r2.status_code == 200

    events = client.get("/events?from=2026-01-01").json()
    assert any(e["title"] == "Consulta inicial" and e["client_id"] == cid for e in events)

def test_convert_lead_twice_conflicts(client):
    lid = client.post("/leads", json={"channel": "phone", "name": "Repeat"}).json()["id"]
    body = {"client": _client_payload("Repeat Client"), "appointment": None}
    r1 = client.post(f"/leads/{lid}/convert", json=body)
    assert r1.status_code == 200
    r2 = client.post(f"/leads/{lid}/convert", json=body)
    assert r2.status_code == 409

def test_match_leads_by_phone_and_email(client):
    client.post("/clients", json=_client_payload(
        "Aina Puig", phone="+34 639 42 18 05", email="aina@mail.cat"))

    r_email = client.get("/leads/match", params={"email": "AINA@MAIL.CAT"})
    assert r_email.status_code == 200
    assert any(m["name"] == "Aina Puig" for m in r_email.json())

    r_phone = client.get("/leads/match", params={"phone": "639421805"})
    assert r_phone.status_code == 200
    assert any(m["name"] == "Aina Puig" for m in r_phone.json())

    r_none = client.get("/leads/match")
    assert r_none.status_code == 200
    assert r_none.json() == []

def _burn_intake_fixture_ids(client):
    # backend/data/intake/client_{1..6}.json are real fixtures on disk (read by
    # path, not mocked) — advance the id sequence past them so a fresh test
    # client/lead doesn't collide with pre-existing intake data.
    for i in range(6):
        client.post("/clients", json=_client_payload(f"Filler {i}"))

def test_intake_fallback_to_lead(client):
    _burn_intake_fixture_ids(client)
    lid = client.post("/leads", json={
        "channel": "whatsapp", "name": "Fallback", "notes": "Vol vestit boho",
    }).json()["id"]
    body = {"client": _client_payload("Fallback Client"), "appointment": None}
    convert = client.post(f"/leads/{lid}/convert", json=body)
    cid = convert.json()["client"]["id"]

    r = client.get(f"/clients/{cid}/intake")
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "lead"
    assert data["channel"] == "whatsapp"
    assert data["message"] == "Vol vestit boho"

def test_intake_404_when_no_file_and_no_lead(client):
    _burn_intake_fixture_ids(client)
    no_client = client.post("/clients", json=_client_payload("No Intake")).json()
    r = client.get(f"/clients/{no_client['id']}/intake")
    assert r.status_code == 404
