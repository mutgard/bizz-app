import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from sqlmodel import create_engine, Session, SQLModel
from main import app
from database import get_session
import monitor

TOKEN = "test-admin-token"
ROOT = {"X-Admin-Token": TOKEN}


@pytest.fixture(name="client")
def client_fixture(tmp_path, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    monitor.reset()
    eng = create_engine(f"sqlite:///{tmp_path}/test.db")
    SQLModel.metadata.create_all(eng)
    def override():
        with Session(eng) as s:
            yield s
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()
    monitor.reset()


def _mk_user(client, email, role, password="secret123", name=""):
    r = client.post("/auth/users", headers=ROOT,
                    json={"email": email, "password": password, "role": role, "name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, email, password="secret123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_bootstrap_token_acts_as_admin(client):
    me = client.get("/auth/me", headers=ROOT).json()
    assert me["role"] == "admin" and me["kind"] == "token"


def test_login_and_me(client):
    _mk_user(client, "julia@tenant.cat", "manager", name="Julia")
    hdr = _login(client, "julia@tenant.cat")
    me = client.get("/auth/me", headers=hdr).json()
    assert me == {"kind": "user", "email": "julia@tenant.cat", "name": "Julia", "role": "manager"}


def test_bad_password_rejected(client):
    _mk_user(client, "x@t.cat", "manager")
    r = client.post("/auth/login", json={"email": "x@t.cat", "password": "wrong"})
    assert r.status_code == 401
    r2 = client.post("/auth/login", json={"email": "ghost@t.cat", "password": "whatever"})
    assert r2.status_code == 401


def test_manager_sees_kpis_only(client):
    _mk_user(client, "mgr@t.cat", "manager")
    hdr = _login(client, "mgr@t.cat")
    assert client.get("/admin/kpis", headers=hdr).status_code == 200
    assert client.get("/admin/errors", headers=hdr).status_code == 403
    assert client.get("/admin/config", headers=hdr).status_code == 403
    assert client.get("/auth/users", headers=hdr).status_code == 403
    assert client.post("/auth/users", headers=hdr,
                       json={"email": "e@t.cat", "password": "p", "role": "manager"}).status_code == 403


def test_admin_user_sees_everything(client):
    _mk_user(client, "boss@t.cat", "admin")
    hdr = _login(client, "boss@t.cat")
    assert client.get("/admin/kpis", headers=hdr).status_code == 200
    assert client.get("/admin/errors", headers=hdr).status_code == 200
    assert client.get("/admin/config", headers=hdr).status_code == 200
    assert client.get("/auth/users", headers=hdr).status_code == 200


def test_duplicate_email_conflict(client):
    _mk_user(client, "dup@t.cat", "manager")
    r = client.post("/auth/users", headers=ROOT,
                    json={"email": "dup@t.cat", "password": "p2", "role": "admin"})
    assert r.status_code == 409


def test_invalid_role_rejected(client):
    r = client.post("/auth/users", headers=ROOT,
                    json={"email": "r@t.cat", "password": "p", "role": "superuser"})
    assert r.status_code == 422


def test_delete_user_revokes_access(client):
    u = _mk_user(client, "gone@t.cat", "admin")
    hdr = _login(client, "gone@t.cat")
    assert client.get("/admin/kpis", headers=hdr).status_code == 200
    assert client.delete(f"/auth/users/{u['id']}", headers=ROOT).status_code == 204
    # JWT still valid cryptographically, but the user row is gone → 401
    assert client.get("/admin/kpis", headers=hdr).status_code == 401
