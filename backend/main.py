import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import create_db, run_migrations
from config import get_pack
import monitor
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.config import router as config_router
from routes.clients import router as clients_router
from routes.fabrics import router as fabrics_router
from routes.shopping import router as shopping_router
from routes.intake import router as intake_router
from routes.brief import router as brief_router
from routes.appointments import router as appointments_router
from routes.deliveries import router as deliveries_router
from routes.events import router as events_router
from routes.payments import router as payments_router
from routes.leads import router as leads_router

app = FastAPI(title=f"{get_pack()['brand']['name']} API")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_origin_regex=r"https://.*\.railway\.app",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.middleware("http")
async def capture_errors(request: Request, call_next):
    """Feed the in-tenant backoffice: record unhandled exceptions and 4xx/5xx
    responses into the monitor ring buffer. /admin traffic is excluded so the
    backoffice doesn't pollute its own error view while being used."""
    try:
        response = await call_next(request)
    except Exception as exc:  # unhandled — record traceback, return clean 500
        monitor.record_exception(request.method, request.url.path, exc)
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
    if response.status_code >= 400 and not request.url.path.startswith("/admin"):
        monitor.record(request.method, request.url.path, response.status_code)
    return response

@app.on_event("startup")
def on_startup():
    from sqlmodel import Session, select
    from models import Client
    from seed import run_seed
    from database import engine
    create_db()
    run_migrations()
    with Session(engine) as s:
        if not s.exec(select(Client)).first():
            run_seed(s)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(config_router)
app.include_router(clients_router)
app.include_router(fabrics_router)
app.include_router(shopping_router)
app.include_router(intake_router)
app.include_router(brief_router)
app.include_router(appointments_router)
app.include_router(deliveries_router)
app.include_router(events_router)
app.include_router(payments_router)
app.include_router(leads_router)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
if os.path.isdir("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse("static/index.html")
