from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

DATABASE_URL = "sqlite:///./atelier.db"
engine = create_engine(DATABASE_URL, echo=False)

def create_db():
    SQLModel.metadata.create_all(engine)

def run_migrations():
    """Add new columns to existing tables. Safe to run repeatedly."""
    new_cols = [
        ("appointment", "date",     "TEXT"),
        ("appointment", "title",    "TEXT"),
        ("appointment", "order_id", "TEXT"),
        ("client",      "custom",   "JSON"),
        ("appointment", "time",         "TEXT"),
        ("appointment", "duration_min", "INTEGER"),
        ("appointment", "outcome",      "TEXT"),
        ("appointment", "source",      "TEXT"),
        ("appointment", "external_ref","TEXT"),
        ("appointment", "context",     "JSON"),
    ]
    with engine.connect() as conn:
        for table, col, typ in new_cols:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
                conn.commit()
            except Exception:
                pass  # column already exists

def get_session():
    with Session(engine) as session:
        yield session
