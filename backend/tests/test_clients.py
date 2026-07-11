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

def test_list_clients_empty(client):
    r = client.get("/clients")
    assert r.status_code == 200
    assert r.json() == []

def test_create_and_get_client(client):
    payload = {
        "name": "Aina Puig", "wedding_date": "17 Mai 2026", "days_until": 28,
        "status": "clienta", "garment": "Vestit a mida",
        "phone": "+34 639 42 18 05", "email": "aina@mail.cat",
        "garment_style": "Princesa modern", "measurements_date": "12 Mar 2026",
        "notes": "", "appointments": [], "payments": [], "fabrics": []
    }
    r = client.post("/clients", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["id"] is not None
    assert data["name"] == "Aina Puig"
    r2 = client.get(f"/clients/{data['id']}")
    assert r2.status_code == 200
    assert r2.json()["status"] == "clienta"

def test_create_client_invalid_status_rejected(client):
    payload = {
        "name": "Bad Status", "wedding_date": "17 Mai 2026", "days_until": 28,
        "status": "not-a-real-status", "garment": "",
        "phone": "", "email": "", "garment_style": "", "measurements_date": "",
        "notes": "", "appointments": [], "payments": [], "fabrics": []
    }
    r = client.post("/clients", json=payload)
    assert r.status_code == 422

def test_patch_client_invalid_status_rejected(client):
    r = client.post("/clients", json={
        "name": "Test", "wedding_date": "01 Jun 2026", "days_until": 43,
        "status": "prospect", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    cid = r.json()["id"]
    r2 = client.patch(f"/clients/{cid}", json={"status": "bogus"})
    assert r2.status_code == 422

def test_patch_client_status(client):
    r = client.post("/clients", json={
        "name": "Test", "wedding_date": "01 Jun 2026", "days_until": 43,
        "status": "prospect", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    cid = r.json()["id"]
    r2 = client.patch(f"/clients/{cid}", json={"status": "clienta"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "clienta"

def test_delete_client(client):
    r = client.post("/clients", json={
        "name": "Del Me", "wedding_date": "01 Jun 2026", "days_until": 43,
        "status": "prospect", "garment": "", "phone": "", "email": "",
        "garment_style": "", "measurements_date": "", "notes": "",
        "appointments": [], "payments": [], "fabrics": []
    })
    cid = r.json()["id"]
    r2 = client.delete(f"/clients/{cid}")
    assert r2.status_code == 204
    r3 = client.get(f"/clients/{cid}")
    assert r3.status_code == 404
