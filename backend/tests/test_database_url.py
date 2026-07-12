import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import _normalize_url


def test_railway_postgres_scheme_rewritten():
    assert (
        _normalize_url("postgres://user:pw@host:5432/db")
        == "postgresql+psycopg://user:pw@host:5432/db"
    )


def test_plain_postgresql_scheme_rewritten():
    assert (
        _normalize_url("postgresql://user:pw@host:5432/db")
        == "postgresql+psycopg://user:pw@host:5432/db"
    )


def test_explicit_psycopg_scheme_untouched():
    url = "postgresql+psycopg://user:pw@host:5432/db"
    assert _normalize_url(url) == url


def test_sqlite_url_untouched():
    url = "sqlite:///./atelier.db"
    assert _normalize_url(url) == url


def test_empty_env_value_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    import importlib
    import database
    importlib.reload(database)
    assert database.DATABASE_URL == database.DEFAULT_DATABASE_URL
    monkeypatch.delenv("DATABASE_URL")
    importlib.reload(database)
