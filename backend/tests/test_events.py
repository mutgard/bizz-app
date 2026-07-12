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

def _make_client(client, wedding_iso="2026-06-14"):
    r = client.post("/clients", json={
        "name": "Sofia Test", "wedding_date": "14 Jun 2026", "days_until": 50,
        "wedding_date_iso": wedding_iso, "status": "clienta",
        "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    return r.json()["id"]

def test_events_empty(client):
    r = client.get("/events?from=2026-01-01&to=2026-12-31")
    assert r.status_code == 200
    assert r.json() == []

def test_events_aggregates_all_types(client):
    cid = _make_client(client, "2026-06-14")
    client.post("/appointments", json={"client_id": cid, "title": "Prova", "date": "2026-05-01", "order_id": None})
    client.post("/deliveries", json={"supplier": "Gratacós", "description": "Seda", "expected_date": "2026-05-10", "client_id": cid, "received": False})
    r = client.get("/events?from=2026-01-01&to=2026-12-31")
    types = {e["type"] for e in r.json()}
    assert types == {"appointment", "delivery", "wedding"}

def test_events_sorted_by_date(client):
    cid = _make_client(client, "2026-08-01")
    client.post("/appointments", json={"client_id": cid, "title": "B", "date": "2026-05-20", "order_id": None})
    client.post("/appointments", json={"client_id": cid, "title": "A", "date": "2026-05-05", "order_id": None})
    dates = [e["date"] for e in client.get("/events?from=2026-01-01&to=2026-12-31").json()]
    assert dates == sorted(dates)

def test_events_date_range_filter(client):
    cid = _make_client(client, "2026-08-01")
    client.post("/appointments", json={"client_id": cid, "title": "May appt", "date": "2026-05-15", "order_id": None})
    events = client.get("/events?from=2026-06-01&to=2026-06-30").json()
    for e in events:
        assert "2026-06-01" <= e["date"] <= "2026-06-30"

def test_events_client_id_filter(client):
    cid1 = _make_client(client, "2026-06-14")
    cid2 = client.post("/clients", json={
        "name": "Other", "wedding_date": "01 Aug 2026", "days_until": 100,
        "wedding_date_iso": "2026-08-01", "status": "clienta",
        "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    }).json()["id"]
    client.post("/appointments", json={"client_id": cid1, "title": "C1", "date": "2026-05-01", "order_id": None})
    client.post("/appointments", json={"client_id": cid2, "title": "C2", "date": "2026-05-05", "order_id": None})
    events = client.get(f"/events?from=2026-01-01&to=2026-12-31&client_id={cid1}").json()
    for e in events:
        assert e["client_id"] == cid1

def test_events_include_new_appointment_fields(client):
    cid = _make_client(client, "2026-08-01")
    client.post("/appointments", json={
        "client_id": cid, "title": "Prova", "date": "2026-05-01", "order_id": None,
        "time": "10:00", "duration_min": 30, "source": "manual", "context": {"note": "x"},
    })
    events = client.get("/events?from=2026-01-01&to=2026-12-31").json()
    appt = next(e for e in events if e["type"] == "appointment")
    assert appt["time"] == "10:00"
    assert appt["duration_min"] == 30
    assert appt["outcome"] is None
    assert appt["source"] == "manual"
    assert appt["context"] == {"note": "x"}

def test_events_other_types_emit_none_new_fields(client):
    cid = _make_client(client, "2026-08-01")
    client.post("/deliveries", json={"supplier": "Gratacós", "description": "Seda", "expected_date": "2026-05-10", "client_id": cid, "received": False})
    events = client.get("/events?from=2026-01-01&to=2026-12-31").json()
    for e in events:
        if e["type"] != "appointment":
            assert e["time"] is None
            assert e["outcome"] is None

def test_events_same_day_sorted_by_time_untimed_first(client):
    cid = _make_client(client, "2026-08-01")
    client.post("/appointments", json={"client_id": cid, "title": "Late", "date": "2026-05-05", "order_id": None, "time": "15:00"})
    client.post("/appointments", json={"client_id": cid, "title": "Untimed", "date": "2026-05-05", "order_id": None})
    client.post("/appointments", json={"client_id": cid, "title": "Early", "date": "2026-05-05", "order_id": None, "time": "08:00"})
    events = [e for e in client.get("/events?from=2026-01-01&to=2026-12-31").json() if e["date"] == "2026-05-05"]
    assert [e["title"] for e in events] == ["Untimed", "Early", "Late"]

def test_wedding_excluded_without_iso(client):
    # Client with no wedding_date_iso should not produce a wedding event
    client.post("/clients", json={
        "name": "No ISO", "wedding_date": "01 Jun 2026", "days_until": 40,
        "status": "clienta", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    events = client.get("/events?from=2026-01-01&to=2026-12-31").json()
    assert all(e["type"] != "wedding" for e in events)
