import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import config


@pytest.fixture(autouse=True)
def fresh_cache():
    config.reset_pack_cache()
    yield
    config.reset_pack_cache()


def test_default_pack_is_atelier_demo(monkeypatch):
    monkeypatch.delenv("ACTIVE_PACK", raising=False)
    assert config.active_pack_id() == "atelier-demo"


def test_demo_pack_extends_base(monkeypatch):
    monkeypatch.setenv("ACTIVE_PACK", "atelier-demo")
    pack = config.get_pack()
    assert pack["id"] == "atelier-demo"                 # id = directory name
    assert pack["brand"]["name"] == "Juliette Atelier"  # inherited from base
    assert "extends" not in pack                        # consumed by the merge
    assert [s["key"] for s in pack["statuses"]["client"]] == [
        "prospect", "sense-paga", "clienta", "entregada"]


def test_base_pack_unchanged(monkeypatch):
    monkeypatch.setenv("ACTIVE_PACK", "atelier")
    assert config.get_pack()["id"] == "atelier"


def test_deep_merge_overrides_nested_keys():
    merged = config._deep_merge(
        {"brand": {"name": "Base", "avatar": "B"}, "nav": [1, 2]},
        {"brand": {"name": "Demo"}, "nav": [3]})
    assert merged == {"brand": {"name": "Demo", "avatar": "B"}, "nav": [3]}


def test_chained_extends_rejected(tmp_path, monkeypatch):
    for pid, body in {
        "a": {"extends": "b"},
        "b": {"extends": "c"},
        "c": {"brand": {}},
    }.items():
        (tmp_path / pid).mkdir()
        (tmp_path / pid / "pack.json").write_text(json.dumps(body))
    monkeypatch.setenv("PACKS_DIR", str(tmp_path))
    monkeypatch.setenv("ACTIVE_PACK", "a")
    with pytest.raises(ValueError, match="chained extends"):
        config.get_pack()


def test_pack_dir_points_at_active_pack(monkeypatch):
    monkeypatch.setenv("ACTIVE_PACK", "physio-demo")
    assert config.pack_dir().name == "physio-demo"
    assert (config.pack_dir("atelier") / "pack.json").exists()
