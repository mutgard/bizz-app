import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import DEFAULT_DATABASE_URL, _normalize_url, resolve_database_url


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


# NOTE: never importlib.reload(database) here — a reload rebinds
# database.engine/get_session for the rest of the pytest session while routes
# keep the originals, silently bypassing dependency overrides (tests then
# write into the real dev database).
def test_empty_env_value_falls_back_to_default():
    assert resolve_database_url("") == DEFAULT_DATABASE_URL


def test_unset_env_value_falls_back_to_default():
    assert resolve_database_url(None) == DEFAULT_DATABASE_URL


def test_env_value_is_normalized():
    assert (
        resolve_database_url("postgres://user:pw@host:5432/db")
        == "postgresql+psycopg://user:pw@host:5432/db"
    )
