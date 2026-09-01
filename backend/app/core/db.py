from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.domain.models import Base

# A sibling of the app package, so /app/data in the container. Counting parents
# from app/core/db.py needs three, not two: parents[2] is /app, parents[1] is
# /app/app. The wrong offset puts the database inside the app package.
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATABASE_PATH = DATA_DIR / "prelegal.db"


@event.listens_for(Engine, "connect")
def _configure_sqlite(connection, _record):
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def build_engine() -> Engine:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{DATABASE_PATH}")


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db() -> None:
    """No migration machinery here by design. The container is never started
    against a database from an earlier build: nothing mounts a volume, so the
    file is created fresh inside the container each run."""
    Base.metadata.create_all(engine)


def get_session() -> Generator[Session]:
    with SessionLocal() as session:
        yield session
