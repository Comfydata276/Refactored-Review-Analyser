# backend/app/main.py

import os
import re
import queue
import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config_manager import ConfigManager
from app.core.steam_api import SteamAPI
from app.core.orchestrator import AnalysisOrchestrator

app = FastAPI(title="Steam Review Analyser API")

# CORS so Electron/React can talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Core singletons ─────────────────────────────────────────────────────────
config_mgr = ConfigManager(config_path="config.yaml", env_path=".env")

# A thread-safe queue for orchestrator → WebSocket
message_queue: queue.Queue = queue.Queue()

orchestrator = AnalysisOrchestrator(
    config_manager=config_mgr,
    gui_queue=message_queue
)

# ── Health & Config Endpoints ──────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/config")
def read_config():
    return config_mgr.config

@app.post("/config")
def write_config(payload: dict):
    # Merge top-level keys and persist
    config_mgr.config.update(payload)
    config_mgr.save_config()
    return {"status": "saved"}

# ── App ID Finder Endpoint ─────────────────────────────────────────────────
def _fuzzy_search_games(query: str, all_apps: dict) -> list[dict]:
    q = query.lower()
    results = []
    # exact
    for aid, name in all_apps.items():
        if name.lower() == q:
            results.append({"appid": aid, "name": name, "score": 100})
    # startswith
    for aid, name in all_apps.items():
        nl = name.lower()
        if nl.startswith(q) and nl != q:
            results.append({"appid": aid, "name": name, "score": 90})
    # contains
    for aid, name in all_apps.items():
        nl = name.lower()
        if q in nl and not nl.startswith(q) and nl != q:
            results.append({"appid": aid, "name": name, "score": 80})
    results.sort(key=lambda x: (-x["score"], x["name"].lower()))
    return results

@app.get("/apps/search")
def search_apps(
    query: str,
    type: str = "name",        # "name" | "id" | "url"
    page: int = 1,
    per_page: int = 20
):
    """
    Search Steam apps by name, AppID, or URL.
    Returns JSON: { total: int, results: [ {appid,name} ] }
    """
    api = SteamAPI(config_mgr)
    results: list[dict] = []

    if type.lower() == "id":
        try:
            aid = int(query)
            name = api.get_app_name(aid)
            if not name.startswith("Unknown App"):
                results = [{"appid": aid, "name": name}]
        except ValueError:
            results = []
    elif type.lower() == "url":
        # extract digits after /app/
        m = re.search(r"/app/(\d+)", query)
        if m:
            aid = int(m.group(1))
            name = api.get_app_name(aid)
            if not name.startswith("Unknown App"):
                results = [{"appid": aid, "name": name}]
    else:
        all_apps = api.get_app_list()
        matches = _fuzzy_search_games(query, all_apps)
        results = matches

    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    paged = results[start:end]

    return {"total": total, "results": paged}

# ── Orchestration Control Endpoints ────────────────────────────────────────
@app.post("/scrape")
def start_scraping(complete: bool = False):
    """
    Begin scraping-only mode.
    Body JSON: { "complete": true|false }
    """
    orchestrator.start_scraping_only(enable_complete_scraping=complete)
    return {"status": "scraping_started", "complete": complete}

@app.post("/analyse")
def start_analysis(complete: bool = False, skip: bool = False):
    """
    Begin full analysis.
    Body JSON: { "complete": true|false, "skip": true|false }
    """
    orchestrator.start_analysis(
        enable_complete_scraping=complete,
        skip_scraping=skip
    )
    return {
        "status": "analysis_started",
        "complete": complete,
        "skip": skip
    }

@app.post("/stop")
def stop_process():
    """
    Send stop signal to any running scrape/analysis.
    """
    orchestrator.stop_analysis()
    return {"status": "stopping"}

# ── WebSocket for real-time logs & progress ─────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Upgrade to WS, then in a loop pull messages off the thread-safe queue and
    forward to the client as JSON.
    """
    await websocket.accept()
    loop = asyncio.get_event_loop()
    try:
        while True:
            # This blocks in a threadpool until an item is available
            msg = await loop.run_in_executor(None, message_queue.get)
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        # Client disconnected; exit quietly
        return