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


def test_config_nav_is_3_tab_4_section_ia():
    # Task 3: nav collapses to today/clients/profile/materials/agenda —
    # 3 mobile tabs (today, clients, materials; profile is a sub-screen and
    # agenda is desktopOnly) / 4 desktop sections (today, clients, materials, agenda).
    pack = client.get("/config").json()
    nav = pack["nav"]
    assert [item["screen"] for item in nav] == [
        "today", "clients", "profile", "materials", "agenda",
    ]
    by_screen = {item["screen"]: item for item in nav}
    assert by_screen["profile"]["sub"] is True
    assert by_screen["agenda"]["desktopOnly"] is True
    assert by_screen["materials"]["feature"] == "fabrics"
    for key in ("nav.today", "nav.clients", "nav.profile", "nav.materials", "nav.agenda"):
        assert key in pack["strings"], f"missing string key {key}"
    for key in (
        "materials.toBuyTab", "materials.inventoryTab",
        "avui.greeting", "avui.todaySection", "avui.urgentSection",
        "avui.glanceSection", "avui.inboxSection", "avui.caixaSection", "avui.todo",
        "caixa.title",
    ):
        assert key in pack["strings"], f"missing string key {key}"
