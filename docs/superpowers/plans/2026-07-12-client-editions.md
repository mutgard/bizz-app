# Client Editions Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Packs become root-level directories with demo-variant packs owning all seed/demo data, `seed.py` becomes a generic token-resolving loader, per-tenant Docker images bake in exactly one pack, and the legacy `atelier/` markdown workspace is retired.

**Architecture:** `packs/<id>/pack.json` (+ optional `seed.json`, `intake/`) at repo root; demo packs declare `{"extends": "<base>"}` and are deep-merged at load. Seeding is data-driven: no `seed.json` in the active pack → no seeding, so tenant images structurally cannot contain demo data. A Docker `pack-select` stage copies only the active pack (+ its base) into the final image.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, pytest; Docker multi-stage build (BuildKit heredocs). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-12-client-editions-design.md`

## Global Constraints

- Default `ACTIVE_PACK` is exactly `"atelier-demo"`.
- Packs live at repo root: `packs/<id>/pack.json`. The merged pack's `id` is always the directory name. `extends` is **single level** — a base that itself extends is a `ValueError`.
- Seed date-token syntax, exactly: `{{iso:+25}}`, `{{disp:-3}}`, `{{short:+2}}`, `{{ts:-12 11:45}}`, `{{days:+25}}` — sign is mandatory, `ts` offset is days (space, then `HH:MM`).
- Models keep ISO `YYYY-MM-DD` dates; display strings are locale-owned seed data.
- No client PII, no secret values, ever committed to this repo.
- Run backend tests as: `cd backend && python3 -m pytest tests/ -q`. If the compose Postgres (from the Postgres spec) isn't running, prefix with `DATABASE_URL=sqlite:///./atelier.db` — the app's startup event touches the global engine even though tests build their own SQLite engines.
- Work on branch `feature/whitelabel-packs`. Commit at the end of every task (and at marked mid-task points).

---

### Task 1: Pack directories + extends-aware config loader

**Files:**
- Move: `backend/packs/atelier.json` → `packs/atelier/pack.json`; `backend/packs/physio.json` → `packs/physio/pack.json`
- Create: `packs/atelier-demo/pack.json`, `packs/physio-demo/pack.json`
- Rewrite: `backend/config.py`
- Create: `backend/tests/test_packs.py`
- Modify: `backend/tests/test_config.py:14`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `config.packs_root() -> Path`; `config.pack_dir(pack_id: str | None = None) -> Path` (directory holding `pack.json` and pack-owned data); `config.active_pack_id() -> str` (default `"atelier-demo"`); `config.get_pack() -> dict` (extends-merged, `id` = dir name); `config.reset_pack_cache()` (unchanged name). Later tasks rely on `pack_dir()` for `seed.json` and `intake/`.

- [ ] **Step 1: Move packs to repo root and create demo pack stubs**

```bash
mkdir -p packs/atelier packs/physio packs/atelier-demo packs/physio-demo
git mv backend/packs/atelier.json packs/atelier/pack.json
git mv backend/packs/physio.json packs/physio/pack.json
printf '{\n  "extends": "atelier"\n}\n' > packs/atelier-demo/pack.json
printf '{\n  "extends": "physio"\n}\n' > packs/physio-demo/pack.json
```

(The `"id"` field inside the moved pack.json files becomes dead weight — the loader overrides it with the directory name. Leave it; removing it is churn.)

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_packs.py`:

```python
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
```

Also update `backend/tests/test_config.py` line 14 — the default pack is now the demo variant:

```python
    assert pack["id"] == "atelier-demo"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_packs.py tests/test_config.py -q`
Expected: FAIL — `config` has no `pack_dir`/`packs_root`; old loader can't find `packs/atelier-demo.json`.

- [ ] **Step 4: Rewrite `backend/config.py`**

```python
"""Active-pack loader. One pack (vertical config) per deployment, selected by
the ACTIVE_PACK env var (default "atelier-demo"). Packs live in packs/<id>/
at the repo root (copied to /app/packs in the Docker image): pack.json plus
optional pack-owned data files (seed.json, intake/). A pack.json may declare
{"extends": "<base-id>"} — single level only — and is deep-merged over its
base; the merged pack's "id" is always the directory name. Loaded lazily and
cached so importing `main` in tests works without any env setup."""
import json
import os
from pathlib import Path


def packs_root() -> Path:
    """packs/ location: PACKS_DIR env override, else next to backend/ (dev:
    <repo>/packs) or inside the app dir (container: /app/packs)."""
    env = os.getenv("PACKS_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve().parent
    for candidate in (here / "packs", here.parent / "packs"):
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("no packs/ directory found; set PACKS_DIR")


_cache: dict[str, dict] = {}


def active_pack_id() -> str:
    return os.getenv("ACTIVE_PACK", "atelier-demo")


def pack_dir(pack_id: str | None = None) -> Path:
    """Directory of a pack (default: the active one) — home of pack.json and
    pack-owned data files like seed.json and intake/."""
    return packs_root() / (pack_id or active_pack_id())


def _read_pack_json(pack_id: str) -> dict:
    with open(pack_dir(pack_id) / "pack.json", encoding="utf-8") as f:
        return json.load(f)


def _deep_merge(base: dict, override: dict) -> dict:
    """Dicts merge recursively; lists and scalars replace."""
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def get_pack() -> dict:
    pack_id = active_pack_id()
    if pack_id not in _cache:
        data = _read_pack_json(pack_id)
        base_id = data.pop("extends", None)
        if base_id:
            base = _read_pack_json(base_id)
            if "extends" in base:
                raise ValueError(
                    f"pack '{pack_id}' extends '{base_id}', which itself "
                    "extends another pack — chained extends is not supported")
            data = _deep_merge(base, data)
        data["id"] = pack_id
        _cache[pack_id] = data
    return _cache[pack_id]


def reset_pack_cache() -> None:
    """Clear the cache — used by tests that switch ACTIVE_PACK at runtime."""
    _cache.clear()
```

Note: `backend/seed.py` (still the legacy version in this task) uses `SEEDS.get(active_pack_id(), ATELIER_SEED)` — with the new `atelier-demo` default it falls back to `ATELIER_SEED`, preserving today's behavior until Task 2 replaces it. No change needed to `backend/main.py` in this task or any other: its startup guard and `run_seed(s)` call are already the final shape.

- [ ] **Step 5: Run the backend suite**

Run: `cd backend && python3 -m pytest tests/ -q`
Expected: all pass (including `test_physio.py`, which sets `ACTIVE_PACK=physio` explicitly and asserts `id == "physio"` — still true since id = dir name).

- [ ] **Step 6: Commit**

```bash
git add -A backend/config.py backend/packs packs backend/tests/test_packs.py backend/tests/test_config.py
git commit -m "feat(packs): root-level pack directories with single-level extends; default pack atelier-demo"
```

---

### Task 2: Generic seed loader with date tokens

**Files:**
- Create: `backend/seed_legacy.py` (verbatim copy of current `backend/seed.py` — parity fixture for Task 3, deleted there)
- Rewrite: `backend/seed.py`
- Create: `backend/tests/test_seed_loader.py`

**Interfaces:**
- Consumes: `config.pack_dir()` from Task 1.
- Produces: `seed.resolve_value(value, month_abbrev: list[str] | None = None)` (recursive token resolution; full-token strings keep native type); `seed.load_seed() -> dict | None` (token-resolved seed.json of the active pack, `None` if absent); `seed.run_seed(s: Session) -> bool` (False = no seed file, nothing done). `main.py` keeps calling `run_seed(s)` unchanged.

- [ ] **Step 1: Preserve the legacy seed as a parity fixture**

```bash
cp backend/seed.py backend/seed_legacy.py
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_seed_loader.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_seed_loader.py -q`
Expected: FAIL — `ImportError: cannot import name 'resolve_value' from 'seed'`.

- [ ] **Step 4: Rewrite `backend/seed.py` as the generic loader**

```python
"""Generic demo-seed loader. Seed data is pack-owned: packs/<id>/seed.json
(only demo packs carry one). No seed.json in the active pack → no-op, so a
tenant deployment can never be seeded with demo data.

Dates in seed.json may be tokens resolved against today at load time, keeping
the demo evergreen: {{iso:+25}} → ISO date, {{disp:+25}} / {{short:-40}} →
display strings via meta.monthAbbrev, {{ts:-12 11:45}} → ISO timestamp,
{{days:+25}} → int. Offsets are days and the sign is mandatory. A string that
is exactly one token keeps the token's native type; tokens embedded in longer
strings interpolate.

Run once: python3 seed.py"""
import datetime
import json
import re
from sqlmodel import Session

from config import pack_dir
from models import Client, Fabric, Appointment, Payment, Delivery, Lead, Note

_TOKEN = re.compile(r"\{\{(iso|disp|short|ts|days):([+-]\d+)(?: (\d{2}:\d{2}))?\}\}")


def _resolve_token(kind: str, offset: int, hhmm: str | None,
                   month_abbrev: list[str] | None):
    d = datetime.date.today() + datetime.timedelta(days=offset)
    if kind == "iso":
        return d.isoformat()
    if kind == "ts":
        return f"{d.isoformat()}T{hhmm}:00"
    if kind == "days":
        return offset
    if month_abbrev is None:
        raise ValueError(f"seed.json uses a {kind} token but has no meta.monthAbbrev")
    if kind == "disp":
        return f"{d.day:02d} {month_abbrev[d.month - 1]} {d.year}"
    return f"{d.day:02d} {month_abbrev[d.month - 1]}"  # short


def resolve_value(value, month_abbrev: list[str] | None = None):
    """Resolve date tokens in a JSON value, recursively."""
    if isinstance(value, str):
        m = _TOKEN.fullmatch(value)
        if m:
            return _resolve_token(m.group(1), int(m.group(2)), m.group(3), month_abbrev)
        return _TOKEN.sub(
            lambda m: str(_resolve_token(m.group(1), int(m.group(2)), m.group(3), month_abbrev)),
            value)
    if isinstance(value, list):
        return [resolve_value(v, month_abbrev) for v in value]
    if isinstance(value, dict):
        return {k: resolve_value(v, month_abbrev) for k, v in value.items()}
    return value


_CHILDREN = {
    "fabrics": Fabric, "appointments": Appointment,
    "payments": Payment, "deliveries": Delivery, "notes": Note,
}


def load_seed() -> dict | None:
    """The active pack's seed.json, token-resolved; None if the pack has no
    seed (tenant packs)."""
    path = pack_dir() / "seed.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    month_abbrev = raw.pop("meta", {}).get("monthAbbrev")
    return resolve_value(raw, month_abbrev)


def run_seed(s: Session) -> bool:
    data = load_seed()
    if data is None:
        return False
    first_client_id = None
    for entry in data.get("clients", []):
        c = Client(**entry["client"])
        s.add(c)
        s.commit()
        s.refresh(c)
        if first_client_id is None:
            first_client_id = c.id
        for key, model in _CHILDREN.items():
            for rec in entry.get(key, []):
                s.add(model(**rec, client_id=c.id))
        s.commit()
    if first_client_id is not None:
        for rec in data.get("today_appointments", []):
            s.add(Appointment(**rec, client_id=first_client_id))
        s.commit()
    for rec in data.get("leads", []):
        s.add(Lead(**rec))
    s.commit()
    return True


if __name__ == "__main__":
    from database import create_db, engine
    create_db()
    with Session(engine) as s:
        seeded = run_seed(s)
    print("Seeded OK" if seeded else "No seed.json in active pack — nothing to do")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_seed_loader.py -q`
Expected: PASS (12 tests). Then the full suite: `python3 -m pytest tests/ -q` — all pass (no existing test calls `run_seed`).

- [ ] **Step 6: Commit**

```bash
git add backend/seed.py backend/seed_legacy.py backend/tests/test_seed_loader.py
git commit -m "feat(seed): generic pack-owned seed loader with evergreen date tokens"
```

---

### Task 3: Convert demo data to seed.json, prove parity, drop the legacy module

**Files:**
- Create: `packs/atelier-demo/seed.json`, `packs/physio-demo/seed.json`
- Create: `backend/tests/test_seed_parity.py` (temporary — deleted at the end of this task together with `backend/seed_legacy.py`)

**Interfaces:**
- Consumes: `seed.run_seed(s) -> bool` and `seed_legacy.run_seed(s)` (Task 2); `config.reset_pack_cache()` (Task 1).
- Produces: the two `seed.json` files — the only demo-data source from here on.

- [ ] **Step 1: Write the parity test**

Create `backend/tests/test_seed_parity.py`:

```python
"""Temporary: proves seed.json transcription matches the legacy Python seed
row-for-row. Deleted (with seed_legacy.py) once green — see the plan."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from sqlmodel import SQLModel, Session, create_engine, select

import config
import models
import seed
import seed_legacy

TABLES = [models.Client, models.Fabric, models.Appointment,
          models.Payment, models.Delivery, models.Lead, models.Note]


def _seed_and_dump(monkeypatch, tmp_path, pack_id, seed_fn, dbname):
    monkeypatch.setenv("ACTIVE_PACK", pack_id)
    config.reset_pack_cache()
    eng = create_engine(f"sqlite:///{tmp_path}/{dbname}.db")
    SQLModel.metadata.create_all(eng)
    out = {}
    with Session(eng) as s:
        seed_fn(s)
        for t in TABLES:
            out[t.__name__] = [
                r.model_dump(exclude={"id"})
                for r in s.exec(select(t).order_by(t.id)).all()
            ]
    return out


@pytest.mark.parametrize("legacy_pack,new_pack",
                         [("atelier", "atelier-demo"), ("physio", "physio-demo")])
def test_seed_parity(monkeypatch, tmp_path, legacy_pack, new_pack):
    old = _seed_and_dump(monkeypatch, tmp_path, legacy_pack, seed_legacy.run_seed, "old")
    new = _seed_and_dump(monkeypatch, tmp_path, new_pack, seed.run_seed, "new")
    for table in old:
        assert new[table] == old[table], f"mismatch in {table}"
```

Run: `cd backend && python3 -m pytest tests/test_seed_parity.py -q`
Expected: FAIL — `packs/atelier-demo/seed.json` doesn't exist yet (`run_seed` returns False, empty tables vs seeded tables).

- [ ] **Step 2: Transcribe `packs/atelier-demo/seed.json`**

Transcribe every entry of `ATELIER_SEED`, `ATELIER_LEAD_SEEDS`, and the atelier variant of `_today_appointments` from `backend/seed_legacy.py`, applying these exact rules:

| Legacy Python | seed.json |
|---|---|
| `_iso(25)` | `"{{iso:+25}}"` |
| `_iso(-40)` | `"{{iso:-40}}"` |
| `_disp(25)` / `_disp(-60)` | `"{{disp:+25}}"` / `"{{disp:-60}}"` |
| `_short(2)` (incl. inside f-strings) | `"{{short:+2}}"` (embedded: `"{{short:+2}} — programada"`) |
| `_ts(12, "11:45")` (**days_ago → sign flips**) | `"{{ts:-12 11:45}}"` |
| `_ts(0, "09:12")` | `"{{ts:+0 09:12}}"` |
| `days_until=25` / `days_until=-220` | `"{{days:+25}}"` / `"{{days:-220}}"` |
| `TODAY.isoformat()` / `f"{today} — done"` | `"{{iso:+0}}"` / `"{{iso:+0}} — done"` |
| literal strings/numbers/bools (`"Pendent"`, `"avui — programada"`, `to_buy=True`) | verbatim (`true`/`false`) |
| model kwargs | same JSON keys; omitted kwargs stay omitted (model defaults must match legacy) |
| `"notes_log"` section key | `"notes"` |
| `fields=None` | `"fields": null` |

File skeleton with the **first client and first lead fully transcribed** as the reference (continue in exactly this shape for the remaining entries — clients: Berta Soler, Clara Ferrer, Dolors Vidal, Elena Roca, Fina Batlle; leads: Mireia Puigdevall, Carmen Iglesias, Alba Torrent, Sophie Laurent, Rosa Peix, Judit Serra, Emma Johansson, Paula Grau i Marta Vives, Griselda Mas — the parity test catches any transcription error):

```json
{
  "meta": {
    "monthAbbrev": ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun",
                    "Jul", "Ago", "Set", "Oct", "Nov", "Des"]
  },
  "clients": [
    {
      "client": {
        "name": "Aina Puig",
        "wedding_date": "{{disp:+25}}",
        "wedding_date_iso": "{{iso:+25}}",
        "days_until": "{{days:+25}}",
        "status": "clienta",
        "garment": "Vestit a mida",
        "garment_style": "Princesa modern",
        "measurements_date": "{{disp:-60}}",
        "phone": "+34 639 42 18 05",
        "email": "aina.puig@mail.cat",
        "notes": "Vol escot en V profund. Ha de poder ballar."
      },
      "fabrics": [
        {"name": "Mikado seda marfil", "use": "Cos", "qty": "3.2 m", "price": "€48/m", "to_buy": true, "supplier": "Gratacós"},
        {"name": "Tul francès", "use": "Vel", "qty": "2.5 m", "price": "€22/m", "to_buy": true, "supplier": "Ribes & Casals"},
        {"name": "Crepe georgette", "use": "Folre", "qty": "4.0 m", "price": "€18/m", "to_buy": false, "supplier": "Gratacós"},
        {"name": "Puntilla Chantilly", "use": "Vora", "qty": "1.2 m", "price": "€95/m", "to_buy": false, "supplier": "Gratacós"}
      ],
      "appointments": [
        {"label": "Prova 1", "value": "{{short:-40}} — feta", "date": "{{iso:-40}}", "title": "Primera prova", "time": "10:00", "outcome": "done"},
        {"label": "Prova 2", "value": "{{short:-12}} — feta", "date": "{{iso:-12}}", "title": "Segona prova", "time": "11:30", "outcome": "done"},
        {"label": "Última prova", "value": "{{short:+2}} — programada", "date": "{{iso:+2}}", "title": "Última prova", "time": "10:00", "duration_min": 60},
        {"label": "Entrega", "value": "{{short:+23}}", "date": "{{iso:+23}}", "title": "Entrega vestit", "time": "09:00", "duration_min": 30}
      ],
      "payments": [
        {"label": "Paga i senyal", "value": "€500 · rebut"},
        {"label": "Saldo", "value": "€1.800 pendent"}
      ],
      "deliveries": [
        {"supplier": "Gratacós", "description": "Mikado seda marfil 3.2m", "expected_date": "{{iso:+5}}", "received": false},
        {"supplier": "Ribes & Casals", "description": "Tul francès 2.5m", "expected_date": "{{iso:+8}}", "received": false}
      ],
      "notes": [
        {"ts": "{{ts:-12 11:45}}", "text": "Prova 2 feta: ajust cintura −2 cm, allargar cola 5 cm. Molt contenta amb el cos."},
        {"ts": "{{ts:-8 17:20}}", "text": "WhatsApp: pregunta si pot venir la mare a l'última prova. Confirmat que sí."},
        {"ts": "{{ts:-3 10:05}}", "text": "Trucada: recordat el saldo pendent abans de l'entrega. Farà bizum aquesta setmana."},
        {"ts": "{{ts:-1 16:40}}", "text": "WhatsApp: envia foto de les sabates definitives (taló 7 cm) — ajustar baix del vestit."}
      ]
    }
  ],
  "today_appointments": [
    {"label": "Cita d'avui", "value": "{{iso:+0}} — done", "date": "{{iso:+0}}", "title": "Cita d'avui", "time": "09:30", "duration_min": 30, "outcome": "done", "source": "manual"},
    {"label": "Cita reservada online", "value": "{{iso:+0}} — booked", "date": "{{iso:+0}}", "title": "Cita reservada online", "time": "16:00", "duration_min": 45, "outcome": "", "source": "booking", "external_ref": "cal-2b7f9e1a",
     "context": {"answers": {"event_type": "Primera visita", "note": "Reservat des del web"}}}
  ],
  "leads": [
    {"channel": "whatsapp", "name": "Núria Bosch", "phone": "+34 655 90 21 47", "email": "",
     "notes": "Busca vestit boho fluid per a cerimònia exterior en un mas (80 convidats), el novembre. Mànigues llargues de gasa, escot paraula d'honor i cola catedralícia. Pressupost al voltant de 2.000€.",
     "fields": {"wedding_date_iso": "{{iso:+125}}", "garment": "Vestit a mida", "garment_style": "Boho fluid"},
     "status": "open", "created_at": "{{ts:+0 09:12}}"}
  ]
}
```

**Transcription gotchas** (each one fails parity if missed): legacy lead notes are Python implicit-concatenation multi-line strings — join them with single spaces exactly as Python does. `Clara Ferrer`'s "Prova 2" `value` is the literal `"avui — programada"`. `Berta Soler`'s `measurements_date` is the literal `"Pendent"`, `Dolors Vidal`'s is `"No preses"`. `Fina Batlle` has negative offsets throughout (`{{disp:-220}}`, `{{days:-220}}`, `{{short:-300}}`…).

- [ ] **Step 3: Transcribe `packs/physio-demo/seed.json`**

Same shape, from `PHYSIO_SEED`, `PHYSIO_LEAD_SEEDS`, and the physio `_today_appointments` variant. The physio seed uses **absolute dates — keep them verbatim** (`"2026-07-16"`, `"2026-07-10T10:00:00"`); no `meta` block is needed (no `disp`/`short` tokens). Clients carry `custom` dicts (pass through verbatim) and only the kwargs the legacy code passes. Only `today_appointments` uses tokens:

```json
{
  "clients": [
    {
      "client": {
        "name": "Marta Vidal", "status": "active",
        "phone": "+34 630 11 22 33", "email": "marta.vidal@mail.com",
        "notes": "Referred after lumbar strain. Twice-weekly sessions.",
        "custom": {"treatment": "Lower-back rehab", "first_visit_date": "2026-06-10", "referring_doctor": "Dr. Serra"}
      },
      "appointments": [
        {"label": "Session 3", "value": "12 Jul — done", "date": "2026-07-12", "title": "Rehab session 3", "time": "09:00"},
        {"label": "Session 4", "value": "16 Jul — scheduled", "date": "2026-07-16", "title": "Rehab session 4", "time": "09:00"}
      ],
      "payments": [
        {"label": "Session pack (10)", "value": "€300 · paid"},
        {"label": "Extension", "value": "€120 outstanding"}
      ]
    }
  ],
  "today_appointments": [
    {"label": "Today's session", "value": "{{iso:+0}} — done", "date": "{{iso:+0}}", "title": "Today's session", "time": "09:30", "duration_min": 30, "outcome": "done", "source": "manual"},
    {"label": "Online booking", "value": "{{iso:+0}} — booked", "date": "{{iso:+0}}", "title": "Online booking", "time": "16:00", "duration_min": 45, "outcome": "", "source": "booking", "external_ref": "cal-2b7f9e1a",
     "context": {"answers": {"event_type": "Initial assessment", "note": "Booked via website"}}}
  ],
  "leads": [
    {"channel": "phone", "name": "Pere Soler", "phone": "+34 611 22 33 44", "email": "",
     "notes": "Knee pain after running, wants an assessment",
     "fields": {"treatment": "Post-op knee"}, "status": "open", "created_at": "2026-07-10T10:00:00"},
    {"channel": "walkin", "name": "Anna Riu", "phone": "", "email": "",
     "notes": "Walked in asking about back pain sessions",
     "fields": {"treatment": "Lower-back rehab"}, "status": "open", "created_at": "2026-07-11T11:20:00"}
  ]
}
```

(Remaining clients to transcribe: Jordi Camps, Laia Font — note the legacy entries pass empty `fabrics`/`deliveries` lists; in JSON simply omit those keys.)

- [ ] **Step 4: Run the parity test until green**

Run: `cd backend && python3 -m pytest tests/test_seed_parity.py -q`
Expected: PASS (2 tests). Any assertion diff pinpoints the mistranscribed table — fix the JSON, not the test. Then full suite: `python3 -m pytest tests/ -q` — all pass.

- [ ] **Step 5: Commit the parity-proven conversion**

```bash
git add packs/atelier-demo/seed.json packs/physio-demo/seed.json backend/tests/test_seed_parity.py
git commit -m "feat(seed): demo data as pack-owned seed.json, parity-verified against legacy seeds"
```

- [ ] **Step 6: Remove the legacy module and parity test, verify, commit**

```bash
git rm backend/seed_legacy.py backend/tests/test_seed_parity.py
cd backend && python3 -m pytest tests/ -q
git commit -m "chore(seed): drop legacy Python seed data now that seed.json parity is proven"
```

---

### Task 4: Intake fixtures become pack-owned

**Files:**
- Move: `backend/data/intake/client_*.json` → `packs/atelier-demo/intake/` (then remove the now-empty `backend/data/`)
- Modify: `backend/routes/brief.py`, `backend/routes/intake.py`
- Create: `backend/tests/test_intake_routes.py`

**Interfaces:**
- Consumes: `config.pack_dir()` from Task 1.
- Produces: routes read `pack_dir() / "intake"`; a pack without an `intake/` dir behaves exactly like today's missing-file path (lead fallback, then 404).

- [ ] **Step 1: Move the fixtures**

```bash
mkdir -p packs/atelier-demo/intake
git mv backend/data/intake/client_1.json backend/data/intake/client_2.json \
       backend/data/intake/client_3.json backend/data/intake/client_4.json \
       backend/data/intake/client_5.json backend/data/intake/client_6.json \
       packs/atelier-demo/intake/
rmdir backend/data/intake backend/data 2>/dev/null || true   # git mv may have removed them already
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_intake_routes.py`:

```python
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
```

Run: `cd backend && python3 -m pytest tests/test_intake_routes.py -q`
Expected: FAIL — routes still look in the removed `backend/data/intake/`.

- [ ] **Step 3: Point the routes at the pack**

`backend/routes/brief.py` becomes:

```python
from fastapi import APIRouter, HTTPException
import json

from config import pack_dir

router = APIRouter(prefix="/api/brief", tags=["brief"])

@router.get("/{token}")
def get_brief(token: str):
    intake_dir = pack_dir() / "intake"
    if intake_dir.is_dir():
        for path in sorted(intake_dir.glob("client_*.json")):
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            if data.get("token") == token:
                brief = data.get("brief", {})
                return {
                    "client_name": data.get("client_name", ""),
                    "wedding_date": brief.get("wedding_date", ""),
                    "venue": brief.get("venue", ""),
                    "garment": brief.get("garment", ""),
                    "style": brief.get("style", ""),
                    "fabric_notes": brief.get("fabric_notes", ""),
                }
    raise HTTPException(status_code=404, detail="Brief not found")
```

In `backend/routes/intake.py`, replace the `os.path` lookup (lines 3–4 imports and 12–16) with:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
import json

from config import pack_dir
from database import get_session
from models import Lead

router = APIRouter(prefix="/clients", tags=["intake"])

@router.get("/{client_id}/intake")
def get_intake(client_id: int, session: Session = Depends(get_session)):
    path = pack_dir() / "intake" / f"client_{client_id}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    lead = session.exec(select(Lead).where(Lead.converted_client_id == client_id)).first()
    if lead:
        return {
            "source": "lead", "channel": lead.channel,
            "received_at": lead.created_at, "message": lead.notes,
            "fields": lead.fields or {}, "brief": None, "documents": [],
        }
    raise HTTPException(status_code=404, detail="No intake data for this client")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_intake_routes.py -q` → PASS (3 tests), then `python3 -m pytest tests/ -q` → all pass.

- [ ] **Step 5: Commit**

```bash
git add -A backend/data packs/atelier-demo/intake backend/routes/brief.py backend/routes/intake.py backend/tests/test_intake_routes.py
git commit -m "feat(packs): intake demo fixtures are pack-owned; routes read via pack_dir()"
```

---

### Task 5: Per-tenant Docker images — pack-select stage + .dockerignore

**Files:**
- Rewrite: `Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: repo-root `packs/` layout (Task 1); `config.packs_root()` finds `/app/packs` in the container with no env needed.
- Produces: `docker build --build-arg ACTIVE_PACK=<id>` → image whose `packs/` holds exactly the active pack plus (for demo packs) its `extends` base; `ENV ACTIVE_PACK` baked to the same id.

- [ ] **Step 1: Create `.dockerignore`**

```
.git
docs
tests
scripts
atelier
.design-sync
**/__pycache__
backend/tests
backend/*.db
frontend/node_modules
frontend/dist
*.md
```

- [ ] **Step 2: Rewrite `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ── Build frontend ──────────────────────────────────────────
FROM node:20-alpine AS fe-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Pack selection ──────────────────────────────────────────
# Only the active pack (+ its "extends" base, for demo packs) reaches the
# final image. This stage is not shipped, so no other pack — and for tenant
# packs, no seed.json — exists in any layer of the published image.
FROM python:3.12-slim AS pack-select
ARG ACTIVE_PACK=atelier-demo
COPY packs/ /all-packs/
RUN python3 <<'PY'
import json, os, shutil
pid = os.environ["ACTIVE_PACK"]
shutil.copytree(f"/all-packs/{pid}", f"/pack/{pid}")
with open(f"/all-packs/{pid}/pack.json", encoding="utf-8") as f:
    base = json.load(f).get("extends")
if base:
    shutil.copytree(f"/all-packs/{base}", f"/pack/{base}")
PY

# ── Backend + serve static ──────────────────────────────────
FROM python:3.12-slim
ARG ACTIVE_PACK=atelier-demo
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=pack-select /pack ./packs
COPY --from=fe-build /app/frontend/dist ./static
ENV ACTIVE_PACK=${ACTIVE_PACK}

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

- [ ] **Step 3: Build and verify the tenant image contains no demo data**

```bash
docker build --build-arg ACTIVE_PACK=atelier -t bizz-app:vtest-atelier .
docker run --rm --entrypoint find bizz-app:vtest-atelier packs -type f
```

Expected output — exactly one line, and **no `seed.json`, no other pack**:

```
packs/atelier/pack.json
```

- [ ] **Step 4: Build and verify the demo image carries seed + base pack**

```bash
docker build --build-arg ACTIVE_PACK=atelier-demo -t bizz-app:vtest-demo .
docker run --rm --entrypoint find bizz-app:vtest-demo packs -type f | sort
```

Expected:

```
packs/atelier-demo/intake/client_1.json
packs/atelier-demo/intake/client_2.json
packs/atelier-demo/intake/client_3.json
packs/atelier-demo/intake/client_4.json
packs/atelier-demo/intake/client_5.json
packs/atelier-demo/intake/client_6.json
packs/atelier-demo/pack.json
packs/atelier-demo/seed.json
packs/atelier/pack.json
```

Also sanity-check the config loads in-container:

```bash
docker run --rm --entrypoint python3 bizz-app:vtest-demo -c "from config import get_pack; p = get_pack(); print(p['id'], p['brand']['name'])"
```

Expected: `atelier-demo Juliette Atelier`

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(docker): bake exactly one pack per image via ACTIVE_PACK build arg + pack-select stage"
```

---

### Task 6: Retire the legacy atelier/ workspace; rewrite CLAUDE.md

**Files:**
- Move: `atelier/wiki/workflows.md` → `docs/business/atelier-workflows.md`; `atelier/wiki/intake-research/` → `docs/business/intake-research/`
- Delete: `atelier/` (rest), `scripts/dashboard.py`, `tests/test_intake.py` (both exist solely to serve the markdown workspace)
- Rewrite: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing from other tasks (independent; ordered last so demo content exists in packs before the old copies vanish).
- Produces: a dev-guide `CLAUDE.md`; salvaged SOP docs under `docs/business/`.

- [ ] **Step 1: Salvage durable knowledge, delete the rest**

```bash
mkdir -p docs/business
git mv atelier/wiki/workflows.md docs/business/atelier-workflows.md
git mv atelier/wiki/intake-research docs/business/intake-research
git rm -r atelier
git rm scripts/dashboard.py tests/test_intake.py
```

(`scripts/` and `tests/` at the repo root become empty and disappear; the backend suite lives in `backend/tests/`. Git history preserves everything deleted.)

- [ ] **Step 2: Rewrite `CLAUDE.md`**

Replace the entire file with:

```markdown
# bizz-app — whitelabel client-management app

One core codebase, whitelabeled per vertical through **packs**, deployed per
client as a pinned Docker image ("client editions"). FastAPI + SQLModel
backend (`backend/`), Vite/React frontend (`frontend/`), packs at `packs/`.

## Pack system

- `packs/<id>/pack.json` — vertical config: brand, locale, theme, strings,
  nav, features, statuses, entities (schema-coupled custom fields). Served
  merged at `GET /config`; the frontend builds theme/strings/nav/fields from
  it at runtime.
- A pack may declare `"extends": "<base>"` (single level, deep-merged, id =
  directory name). Demo packs (`atelier-demo`, `physio-demo`) extend their
  base and own the demo data: `seed.json`, `intake/` fixtures. **Tenant packs
  never carry seed data** — that is what makes demo-data leaks into client
  deployments structurally impossible.
- `ACTIVE_PACK` env selects the pack (default `atelier-demo`, so a bare local
  run gets the seeded demo). Tenant images bake exactly one pack via
  `docker build --build-arg ACTIVE_PACK=<id>`.

## Seeding

`backend/seed.py` is a generic loader for the active pack's `seed.json`;
startup seeds only when the client table is empty (see `main.py`). Seed dates
use evergreen tokens (`{{iso:+25}}`, `{{disp:-3}}`, `{{short:+2}}`,
`{{ts:-12 11:45}}`, `{{days:+25}}`) resolved against today at load time.

## Conventions

- Dates in models: ISO `YYYY-MM-DD`; display strings are pack/locale-owned.
- Tests: `cd backend && python3 -m pytest tests/ -q`. Tests needing a specific
  pack set `ACTIVE_PACK` and call `config.reset_pack_cache()` (see
  `tests/test_physio.py`).
- Never commit client PII or secret values to this repo. Client data lives in
  each tenant's database.

## Deployment

See `docs/deployment.md`. A client edition = pinned core image (pack baked
in) + env (`DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS`). Per-tenant
manifests live in the private `bizz-tenants` repo; secrets live only in
Railway.
```

- [ ] **Step 3: Verify nothing referenced the deleted paths**

Run: `grep -rn "atelier/" --include="*.py" backend frontend/src 2>/dev/null; grep -rn "dashboard.py\|data/intake" backend --include="*.py" | grep -v __pycache__`
Expected: no output. Then `cd backend && python3 -m pytest tests/ -q` → all pass.

- [ ] **Step 4: Commit**

```bash
git add -A atelier docs/business scripts tests CLAUDE.md
git commit -m "chore: retire legacy atelier/ markdown workspace; CLAUDE.md becomes a dev guide"
```

(Stage explicit paths only — never bare `git add -A`: a parallel design session shares this working tree via `.design-sync/` and `docs/design/`.)

---

### Task 7: Deployment docs — client editions

**Files:**
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes: build-arg contract from Task 5; demo-pack seeding behavior from Tasks 2–3.
- Produces: the runbook later copied into `bizz-tenants/README.md` at first tenant onboarding (the `bizz-tenants` repo itself is out of scope, per spec).

- [ ] **Step 1: Update stale statements and append the editions section**

In `docs/deployment.md`:

1. In **Local development**, replace the sentence "On first boot against an empty database, startup creates tables, applies column migrations, and seeds demo data; on later boots the seed is skipped." with:

```markdown
On first boot against an empty database, startup creates tables and applies
column migrations; demo data is seeded only when the active pack is a demo
pack (`atelier-demo`, the default, or `physio-demo`) — tenant packs contain
no seed data at all.
```

2. In **Release to Railway**, replace step 3 with:

```markdown
3. Set service variables (see `.env.example`): `AUTH_SECRET` (required in
   production), `CORS_ORIGINS` if serving a custom domain, and `ACTIVE_PACK`
   set to the tenant's pack (e.g. `atelier`). Railway exposes service
   variables to the Docker build, so the `ACTIVE_PACK` build arg bakes that
   one pack into the image and the same value is set at runtime.
```

3. Append at the end of the file:

```markdown
## Client editions

A tenant deployment ("client edition") is fully described by three things:

1. **Pinned core image** — built from a tagged commit with the pack baked in:
   `docker build --build-arg ACTIVE_PACK=atelier -t bizz-app:<version>-atelier .`
   The image contains only that pack (a demo pack also carries its base);
   tenant images contain no `seed.json`, so demo data cannot leak into a
   client deployment.
2. **Pack id** — determines schema custom fields, strings, theme, and nav.
3. **Env** — `DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS`. The tenant's
   Postgres is the system of record for all client data; nothing
   client-specific lives in git.

Per-tenant manifests (core version pin, pack id, Railway project ref, env var
*names*) live in the private `bizz-tenants` repo — one small YAML per tenant:

```yaml
# bizz-tenants/juliette.yaml
core: v1.4.2
pack: atelier
railway: juliette-prod
env: [DATABASE_URL, AUTH_SECRET, CORS_ORIGINS]   # names only, values in Railway
```

Upgrading a tenant = bump `core:` in its manifest, redeploy the matching
image tag in Railway. Secret values live only in Railway, never in git.
```

- [ ] **Step 2: Commit**

```bash
git add docs/deployment.md
git commit -m "docs(deployment): client editions — per-tenant images, demo-pack seeding, tenant manifests"
```
