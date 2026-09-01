from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.db import init_db
from app.routers import auth

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prelegal", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)

# Last, and everything that answers under /api goes above it. StaticFiles is
# mounted at / as a catch-all, so a route registered after this line is
# unreachable. html=True is what serves login/index.html for /login/, which is
# why the frontend exports with trailingSlash.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
