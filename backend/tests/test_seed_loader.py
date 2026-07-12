import sys, os, datetime, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from seed import resolve_value, load_seed, run_seed

ABBREV = ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun",
          "Jul", "Ago", "Set", "Oct", "Nov", "Des"]


def _d(n):
    return datetime.date.today() + datetime.timedelta(days=n)


def test_iso_token():
    assert resolve_value("{{iso:+25}}") == _d(25).isoformat()


def test_negative_offset():
    assert resolve_value("{{iso:-40}}") == _d(-40).isoformat()


def test_disp_token():
    d = _d(3)
    assert resolve_value("{{disp:+3}}", ABBREV) == f"{d.day:02d} {ABBREV[d.month - 1]} {d.year}"


def test_short_embedded_keeps_string():
    d = _d(-40)
    assert resolve_value("{{short:-40}} — feta", ABBREV) == f"{d.day:02d} {ABBREV[d.month - 1]} — feta"


def test_ts_token():
    assert resolve_value("{{ts:-12 11:45}}") == f"{_d(-12).isoformat()}T11:45:00"


def test_days_full_value_is_int():
    assert resolve_value("{{days:+25}}") == 25
    assert resolve_value("{{days:-220}}") == -220


def test_recurses_containers():
    out = resolve_value({"a": ["{{iso:+1}}"], "b": {"c": "{{days:+2}}"}})
    assert out == {"a": [_d(1).isoformat()], "b": {"c": 2}}


def test_plain_values_untouched():
    assert resolve_value("2026-07-16") == "2026-07-16"
    assert resolve_value(42) == 42
    assert resolve_value(None) is None


def test_disp_without_month_abbrev_raises():
    with pytest.raises(ValueError, match="monthAbbrev"):
        resolve_value("{{disp:+1}}")


def test_load_seed_none_for_tenant_pack(monkeypatch):
    import config
    monkeypatch.setenv("ACTIVE_PACK", "atelier")   # tenant pack: no seed.json
    config.reset_pack_cache()
    assert load_seed() is None


def test_run_seed_noop_for_tenant_pack(monkeypatch, tmp_path):
    import config
    from sqlmodel import SQLModel, Session, create_engine, select
    from models import Client
    monkeypatch.setenv("ACTIVE_PACK", "atelier")
    config.reset_pack_cache()
    eng = create_engine(f"sqlite:///{tmp_path}/t.db")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        assert run_seed(s) is False
        assert s.exec(select(Client)).first() is None


def test_run_seed_from_seed_json(monkeypatch, tmp_path):
    import config
    from sqlmodel import SQLModel, Session, create_engine, select
    from models import Client, Note, Lead, Appointment
    pack = tmp_path / "mini-demo"
    pack.mkdir()
    (pack / "pack.json").write_text('{"extends": "atelier"}')
    (pack / "seed.json").write_text(json.dumps({
        "meta": {"monthAbbrev": ABBREV},
        "clients": [{
            "client": {"name": "Test Bride", "status": "clienta",
                       "wedding_date": "{{disp:+10}}",
                       "wedding_date_iso": "{{iso:+10}}",
                       "days_until": "{{days:+10}}"},
            "appointments": [{"label": "Prova 1", "value": "{{short:+2}} — programada",
                              "date": "{{iso:+2}}", "title": "Primera prova"}],
            "notes": [{"ts": "{{ts:-1 10:00}}", "text": "hola"}],
        }],
        "today_appointments": [{"label": "Avui", "value": "{{iso:+0}} — done",
                                "date": "{{iso:+0}}", "title": "Avui",
                                "outcome": "done", "source": "manual"}],
        "leads": [{"channel": "whatsapp", "name": "L", "status": "open",
                   "created_at": "{{ts:+0 09:00}}"}],
    }))
    monkeypatch.setenv("PACKS_DIR", str(tmp_path))
    monkeypatch.setenv("ACTIVE_PACK", "mini-demo")
    config.reset_pack_cache()
    eng = create_engine(f"sqlite:///{tmp_path}/t.db")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        assert run_seed(s) is True
        c = s.exec(select(Client)).one()
        assert c.name == "Test Bride"
        assert c.wedding_date_iso == _d(10).isoformat()
        assert c.days_until == 10
        appts = s.exec(select(Appointment)).all()
        assert {a.title for a in appts} == {"Primera prova", "Avui"}
        assert all(a.client_id == c.id for a in appts)   # today_appointments attach to first client
        assert s.exec(select(Note)).one().ts == f"{_d(-1).isoformat()}T10:00:00"
        assert s.exec(select(Lead)).one().created_at == f"{_d(0).isoformat()}T09:00:00"


def test_ts_token_requires_time():
    with pytest.raises(ValueError, match="HH:MM"):
        resolve_value("{{ts:+0}}")


def test_unknown_top_level_seed_key_rejected(monkeypatch, tmp_path):
    import config
    pack = tmp_path / "typo-demo"
    pack.mkdir()
    (pack / "pack.json").write_text("{}")
    (pack / "seed.json").write_text(json.dumps({"clientz": [], "leads": []}))
    monkeypatch.setenv("PACKS_DIR", str(tmp_path))
    monkeypatch.setenv("ACTIVE_PACK", "typo-demo")
    config.reset_pack_cache()
    with pytest.raises(ValueError, match="clientz"):
        load_seed()
