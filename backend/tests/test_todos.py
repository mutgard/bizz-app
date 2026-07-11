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

def _make_client(client, **overrides):
    body = {
        "name": "Test", "wedding_date": "01 Jun 2026", "days_until": 20,
        "status": "clienta", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    }
    body.update(overrides)
    r = client.post("/clients", json=body)
    return r.json()["id"]

def test_schedule_fitting_for_near_date_client_with_no_appointments(client):
    cid = _make_client(client, name="Anna", days_until=20)
    r = client.get("/todos")
    assert r.status_code == 200
    todos = r.json()
    matches = [t for t in todos if t["type"] == "schedule_fitting" and t["client_id"] == cid]
    assert len(matches) == 1
    assert matches[0]["client_name"] == "Anna"
    assert matches[0]["days_until"] == 20

def test_collect_deposit_excludes_paid_client(client):
    cid = _make_client(client, name="Paid Client", days_until=20, payments=[
        {"label": "Dipòsit", "value": "€300 rebut"}
    ])
    r = client.get("/todos")
    todos = r.json()
    matches = [t for t in todos if t["type"] == "collect_deposit" and t["client_id"] == cid]
    assert matches == []

def test_collect_deposit_includes_unpaid_client(client):
    cid = _make_client(client, name="Unpaid Client", days_until=20, payments=[
        {"label": "Total", "value": "€300"}
    ])
    r = client.get("/todos")
    todos = r.json()
    matches = [t for t in todos if t["type"] == "collect_deposit" and t["client_id"] == cid]
    assert len(matches) == 1
    assert matches[0]["client_name"] == "Unpaid Client"

def test_open_lead_produces_review_lead_todo(client):
    lr = client.post("/leads", json={"channel": "phone", "name": "Nova Client", "phone": "", "email": "", "notes": "", "fields": {}})
    assert lr.status_code == 201
    r = client.get("/todos")
    todos = r.json()
    matches = [t for t in todos if t["type"] == "review_lead" and t["client_name"] == "Nova Client"]
    assert len(matches) == 1
    assert matches[0]["client_id"] is None
