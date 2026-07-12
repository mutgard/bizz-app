import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine, Session, SQLModel
from main import app
from database import get_session
import monitor

TOKEN = "test-admin-token"
HDR = {"X-Admin-Token": TOKEN}


@pytest.fixture(name="client")
def client_fixture(tmp_path, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    monitor.reset()
    url = f"sqlite:///{tmp_path}/test.db"
    eng = create_engine(url)
    SQLModel.metadata.create_all(eng)
    def override():
        with Session(eng) as s:
            yield s
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()
    monitor.reset()


def test_admin_unauthorized_without_env(client, monkeypatch):
    # no ADMIN_TOKEN and no users → nothing can authenticate
    monkeypatch.delenv("ADMIN_TOKEN")
    assert client.get("/admin/kpis").status_code == 401


def test_admin_rejects_bad_token(client):
    assert client.get("/admin/kpis").status_code == 401
    assert client.get("/admin/kpis", headers={"X-Admin-Token": "nope"}).status_code == 401
    # Bearer form also accepted
    r = client.get("/admin/kpis", headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 200


def test_kpis_totals(client):
    client.post("/clients", json={
        "name": "Aina Puig", "status": "clienta",
        "payments": [
            {"label": "Paga i senyal", "value": "€500 · rebut"},
            {"label": "Saldo", "value": "€1.800 pendent"},
        ],
        "appointments": [], "fabrics": [],
    })
    k = client.get("/admin/kpis", headers=HDR).json()
    assert k["pack"] == "atelier-demo"
    assert k["clients_total"] == 1
    assert k["clients_by_status"]["clienta"] == 1
    assert k["payments_count"] == 2
    assert k["revenue_total"] == 2300.0     # 500 + 1.800 (ca thousands dot)
    assert k["revenue_paid"] == 500.0        # 'rebut' keyword
    assert k["revenue_outstanding"] == 1800.0
    assert k["currency"] == "€"


def test_errors_captured(client):
    client.get("/clients/99999")  # 404
    body = client.get("/admin/errors", headers=HDR).json()
    assert body["count"] >= 1
    entry = body["errors"][0]
    assert entry["path"] == "/clients/99999"
    assert entry["status"] == 404


def test_config_returns_pack_and_runtime(client):
    body = client.get("/admin/config", headers=HDR).json()
    assert body["pack_id"] == "atelier-demo"
    assert body["pack"]["brand"]["name"] == "Juliette Atelier"
    assert body["runtime"]["backoffice_phase"].startswith("1")
    assert "uptime_seconds" in body["runtime"]
