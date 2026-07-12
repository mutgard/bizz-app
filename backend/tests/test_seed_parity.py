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
