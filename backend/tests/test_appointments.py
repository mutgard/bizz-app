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
        "name": "Test", "wedding_date": "01 Jun 2026", "days_until": 40,
        "status": "clienta", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    return r.json()["id"]

def test_create_appointment(client):
    cid = _make_client(client)
    r = client.post("/appointments", json={
        "client_id": cid, "title": "Primera prova", "date": "2026-04-15", "order_id": None
    })
    assert r.status_code == 201
    ev = r.json()
    assert ev["type"] == "appointment"
    assert ev["date"] == "2026-04-15"
    assert ev["title"] == "Primera prova"
    assert ev["client_id"] == cid

def test_create_appointment_no_client(client):
    r = client.post("/appointments", json={
        "client_id": None, "title": "Reunió estudi", "date": "2026-04-30", "order_id": None
    })
    assert r.status_code == 201
    assert r.json()["client_id"] is None

def test_update_appointment(client):
    cid = _make_client(client)
    aid = client.post("/appointments", json={
        "client_id": cid, "title": "Primera prova", "date": "2026-04-15", "order_id": None
    }).json()["id"]
    r = client.patch(f"/appointments/{aid}", json={"title": "Prova actualitzada", "date": "2026-04-20"})
    assert r.status_code == 200
    assert r.json()["title"] == "Prova actualitzada"
    assert r.json()["date"] == "2026-04-20"

def test_delete_appointment(client):
    cid = _make_client(client)
    aid = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15", "order_id": None
    }).json()["id"]
    assert client.delete(f"/appointments/{aid}").status_code == 204
    # Verify deleted: second delete should 404
    assert client.delete(f"/appointments/{aid}").status_code == 404

def test_appointment_404(client):
    assert client.patch("/appointments/9999", json={"title": "x"}).status_code == 404
    assert client.delete("/appointments/9999").status_code == 404

def test_create_appointment_new_fields_round_trip(client):
    cid = _make_client(client)
    r = client.post("/appointments", json={
        "client_id": cid, "title": "Primera prova", "date": "2026-04-15",
        "order_id": None, "time": "09:30", "duration_min": 45,
        "source": "manual", "external_ref": None, "context": {"note": "puntual"},
    })
    assert r.status_code == 201
    ev = r.json()
    assert ev["time"] == "09:30"
    assert ev["duration_min"] == 45
    assert ev["source"] == "manual"
    assert ev["context"] == {"note": "puntual"}
    assert ev["outcome"] is None

def test_create_appointment_booking_shaped(client):
    r = client.post("/appointments", json={
        "client_id": None, "title": "Reserva online", "date": "2026-04-30",
        "order_id": None, "time": "16:00", "duration_min": 30,
        "source": "booking", "external_ref": "cal-abc123",
        "context": {"answers": {"event_type": "Primera visita"}},
    })
    assert r.status_code == 201
    ev = r.json()
    assert ev["source"] == "booking"
    assert ev["context"] == {"answers": {"event_type": "Primera visita"}}

def test_patch_appointment_outcome(client):
    cid = _make_client(client)
    aid = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15", "order_id": None
    }).json()["id"]
    r = client.patch(f"/appointments/{aid}", json={"outcome": "done"})
    assert r.status_code == 200
    assert r.json()["outcome"] == "done"
    r = client.patch(f"/appointments/{aid}", json={"outcome": "no_show"})
    assert r.status_code == 200
    assert r.json()["outcome"] == "no_show"

def test_patch_appointment_outcome_bogus_422(client):
    cid = _make_client(client)
    aid = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15", "order_id": None
    }).json()["id"]
    r = client.patch(f"/appointments/{aid}", json={"outcome": "cancelled"})
    assert r.status_code == 422

def test_appointment_time_validation(client):
    cid = _make_client(client)
    r = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15",
        "order_id": None, "time": "9:00",
    })
    assert r.status_code == 422
    r = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15",
        "order_id": None, "time": "09:00",
    })
    assert r.status_code == 201

def test_appointment_duration_min_negative_422(client):
    cid = _make_client(client)
    r = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15",
        "order_id": None, "duration_min": -15,
    })
    assert r.status_code == 422

def test_appointment_duration_min_zero_422(client):
    # "positive" means 0 is rejected too — lock the boundary
    cid = _make_client(client)
    r = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15",
        "order_id": None, "duration_min": 0,
    })
    assert r.status_code == 422

def test_patch_appointment_context_merges_not_replaces(client):
    cid = _make_client(client)
    aid = client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-04-15", "order_id": None,
        "context": {"a": 1, "b": 2},
    }).json()["id"]
    r = client.patch(f"/appointments/{aid}", json={"context": {"b": 3, "c": 4}})
    assert r.status_code == 200
    assert r.json()["context"] == {"a": 1, "b": 3, "c": 4}
