import asyncio
import sys

# Windows consoles often default to cp1252; character messages contain emoji
# and unicode, so debug prints would raise UnicodeEncodeError without this.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .proactive import proactive_loop
from .routers import chat, characters, users, chub, memories, lorebooks, group_chat, notifications, friends

# Initialize FastAPI app
app = FastAPI(
    title="Sluxa Web API",
    description="Character AI Chat Web Application API",
    version="1.0.0"
)

# CORS configuration for frontend
_settings = get_settings()
_configured_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Automatically permit Vercel preview & production deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database and start the proactive-messaging scheduler"""
    init_db()
    if get_settings().proactive_enabled:
        asyncio.create_task(proactive_loop())


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "Sluxa Web API is running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Include routers
app.include_router(users.router, prefix="/api")
app.include_router(characters.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(chub.router, prefix="/api")
app.include_router(memories.router, prefix="/api")
app.include_router(lorebooks.router, prefix="/api")
app.include_router(group_chat.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(friends.router, prefix="/api")
