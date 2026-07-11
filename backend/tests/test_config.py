import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_config_returns_active_pack():
    r = client.get("/config")
    assert r.status_code == 200
    pack = r.json()
    assert pack["id"] == "atelier"
    assert pack["brand"]["name"] == "Juliette Atelier"


def test_config_has_required_shape():
    pack = client.get("/config").json()
    # sections the frontend boot depends on
    assert set(pack["brand"]["colors"]).issuperset({"paper", "ink", "accent", "gold"})
    assert {"serif", "sans", "mono"}.issubset(pack["brand"]["fonts"])
    assert [s["key"] for s in pack["statuses"]["client"]] == [
        "prospect", "sense-paga", "clienta", "entregada"
    ]
    assert pack["locale"]["code"] == "ca"
