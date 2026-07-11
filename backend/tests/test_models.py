import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlmodel import Session, create_engine, SQLModel
from database import create_db
from models import Client

def test_create_client(tmp_path, monkeypatch):
    import database
    url = f"sqlite:///{tmp_path}/test.db"
    eng = create_engine(url)
    monkeypatch.setattr(database, "engine", eng)
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        c = Client(name="Aina Puig", wedding_date="17 Mai 2026", days_until=28,
                   status="clienta", garment="Vestit a mida",
                   phone="+34 639 42 18 05", email="aina@mail.cat")
        s.add(c); s.commit(); s.refresh(c)
        assert c.id is not None
        assert c.status == "clienta"

def test_fabric_relationship(tmp_path, monkeypatch):
    import database
    from models import Fabric
    url = f"sqlite:///{tmp_path}/test.db"
    eng = create_engine(url)
    monkeypatch.setattr(database, "engine", eng)
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        c = Client(name="Test", wedding_date="17 Mai 2026", days_until=28,
                   status="clienta", garment="Vestit")
        s.add(c); s.commit(); s.refresh(c)
        f = Fabric(client_id=c.id, name="Mikado", use="Cos",
                   qty="3.2 m", price="€48/m", to_buy=True, supplier="Gratacós")
        s.add(f); s.commit()
        s.refresh(c)
        fabrics = s.exec(
            __import__('sqlmodel').select(Fabric).where(Fabric.client_id == c.id)
        ).all()
        assert len(fabrics) == 1
        assert fabrics[0].name == "Mikado"
        assert fabrics[0].to_buy is True
