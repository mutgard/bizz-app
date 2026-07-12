import os
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

# Local docker-compose Postgres (see docker-compose.yml). Railway injects its
# own DATABASE_URL in production; tests build their own SQLite engines.
DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/atelier"


def _normalize_url(url: str) -> str:
    """Rewrite postgres:// / postgresql:// to the psycopg3 dialect.

    Railway injects postgres://, which SQLAlchemy 2 rejects, and a bare
    postgresql:// would select the (uninstalled) psycopg2 driver. Non-Postgres
    URLs (sqlite) pass through untouched.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _normalize_url(os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
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
                # Column already exists. On Postgres the failed statement also
                # aborts the transaction; roll back or every later ALTER on
                # this connection is silently skipped.
                conn.rollback()

def get_session():
    with Session(engine) as session:
        yield session
