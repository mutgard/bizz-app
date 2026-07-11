import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine, Session, SQLModel


@pytest.fixture(name="physio_client")
def physio_client_fixture(tmp_path, monkeypatch):
    monkeypatch.setenv("ACTIVE_PACK", "physio")
    import config
    config.reset_pack_cache()
    from main import app
    from database import get_session
    eng = create_engine(f"sqlite:///{tmp_path}/physio.db")
    SQLModel.metadata.create_all(eng)
    def override():
        with Session(eng) as s:
            yield s
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()
    config.reset_pack_cache()


def test_physio_pack_loads(physio_client):
    pack = physio_client.get("/config").json()
    assert pack["id"] == "physio"
    assert [s["key"] for s in pack["statuses"]["client"]] == ["new", "active", "discharged"]
    assert pack["features"]["fabrics"] is False


def test_physio_client_crud_with_custom(physio_client):
    # a physio status is valid; an atelier status is not
    r = physio_client.post("/clients", json={
        "name": "Marta Vidal", "status": "active",
        "custom": {"treatment": "Lower-back rehab", "referring_doctor": "Dr. Serra"},
        "appointments": [], "payments": [], "fabrics": []
    })
    assert r.status_code == 201
    assert r.json()["custom"]["treatment"] == "Lower-back rehab"

    # atelier-only status must be rejected under the physio pack
    r2 = physio_client.post("/clients", json={
        "name": "X", "status": "clienta",
        "appointments": [], "payments": [], "fabrics": []
    })
    assert r2.status_code == 422
