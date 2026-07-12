import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine

import config
from main import app
from database import get_session

FIXTURES = config.pack_dir("atelier-demo") / "intake"


@pytest.fixture(name="client")
def client_fixture(tmp_path, monkeypatch):
    monkeypatch.setenv("ACTIVE_PACK", "atelier-demo")
    config.reset_pack_cache()
    eng = create_engine(f"sqlite:///{tmp_path}/test.db")
    SQLModel.metadata.create_all(eng)

    def override():
        with Session(eng) as s:
            yield s

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()
    config.reset_pack_cache()


def test_intake_served_from_pack_fixture(client):
    with open(FIXTURES / "client_1.json", encoding="utf-8") as f:
        fixture = json.load(f)
    r = client.get("/clients/1/intake")
    assert r.status_code == 200
    assert r.json()["client_name"] == fixture["client_name"]


def test_brief_found_by_fixture_token(client):
    with open(FIXTURES / "client_1.json", encoding="utf-8") as f:
        token = json.load(f)["token"]
    r = client.get(f"/api/brief/{token}")
    assert r.status_code == 200
    assert "client_name" in r.json()


def test_tenant_pack_has_no_intake_fixtures(client, monkeypatch):
    monkeypatch.setenv("ACTIVE_PACK", "atelier")   # tenant pack: no intake/ dir
    config.reset_pack_cache()
    assert client.get("/clients/1/intake").status_code == 404
    assert client.get("/api/brief/anything").status_code == 404
