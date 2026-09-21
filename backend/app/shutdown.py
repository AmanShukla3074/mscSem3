"""
app/shutdown.py
Holds the global asyncio.Event that is set by the lifespan teardown in main.py
when the server begins shutting down.

Routers and service generators import from here (not from app.main) to avoid
circular imports.
"""

from __future__ import annotations

import asyncio

# Set during lifespan teardown; streaming generators poll this to exit
# their loops cleanly so Uvicorn can finish a graceful shutdown quickly.
shutdown_event: asyncio.Event = asyncio.Event()
