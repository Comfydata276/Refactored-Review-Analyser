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

# ── Prompt Management Endpoints ────────────────────────────────────────────
@app.get("/prompt")
def get_prompt():
    """
    Get the current analysis prompt content.
    """
    try:
        prompt_path = os.path.join(os.path.dirname(__file__), "prompt.txt")
        with open(prompt_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Prompt file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading prompt: {str(e)}")

@app.post("/prompt")
def save_prompt(payload: dict):
    """
    Save new prompt content.
    Body JSON: { "content": "prompt text here" }
    """
    try:
        if "content" not in payload:
            raise HTTPException(status_code=400, detail="Missing 'content' field")
        
        prompt_path = os.path.join(os.path.dirname(__file__), "prompt.txt")
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(payload["content"])
        
        return {"status": "saved", "message": "Prompt updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving prompt: {str(e)}")

# ── Results Management Endpoints ───────────────────────────────────────────
@app.get("/results/files")
def get_results_files():
    """
    Get list of available analysis result files.
    Returns both raw and analysed CSV files with metadata.
    """
    try:
        results = {
            "raw_files": [],
            "analysed_files": [],
            "summary_files": []
        }
        
        # Get paths from config
        raw_folder = os.path.join(os.path.dirname(__file__), "..", "output", "raw")
        analysed_folder = os.path.join(os.path.dirname(__file__), "..", "output", "analysed") 
        summary_folder = os.path.join(os.path.dirname(__file__), "..", "output", "summary")
        
        # List raw files
        if os.path.exists(raw_folder):
            for filename in os.listdir(raw_folder):
                if filename.endswith('.csv'):
                    filepath = os.path.join(raw_folder, filename)
                    file_stats = os.stat(filepath)
                    results["raw_files"].append({
                        "filename": filename,
                        "path": filepath,
                        "size": file_stats.st_size,
                        "modified": file_stats.st_mtime,
                        "type": "raw"
                    })
        
        # List analysed files  
        if os.path.exists(analysed_folder):
            for filename in os.listdir(analysed_folder):
                if filename.endswith('.csv'):
                    filepath = os.path.join(analysed_folder, filename)
                    file_stats = os.stat(filepath)
                    results["analysed_files"].append({
                        "filename": filename,
                        "path": filepath,
                        "size": file_stats.st_size,
                        "modified": file_stats.st_mtime,
                        "type": "analysed"
                    })
        
        # List summary files
        if os.path.exists(summary_folder):
            for filename in os.listdir(summary_folder):
                if filename.endswith('.json'):
                    filepath = os.path.join(summary_folder, filename)
                    file_stats = os.stat(filepath)
                    results["summary_files"].append({
                        "filename": filename,
                        "path": filepath,
                        "size": file_stats.st_size,
                        "modified": file_stats.st_mtime,
                        "type": "summary"
                    })
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading results files: {str(e)}")

@app.get("/results/file/{file_type}/{filename}")
def get_results_file_content(file_type: str, filename: str, limit: int = 100):
    """
    Get content of a specific results file.
    file_type: 'raw', 'analysed', or 'summary'
    filename: name of the file
    limit: number of rows to return (for CSV files)
    """
    try:
        # Validate file_type
        if file_type not in ['raw', 'analysed', 'summary']:
            raise HTTPException(status_code=400, detail="Invalid file_type. Must be 'raw', 'analysed', or 'summary'")
        
        # Build file path
        base_path = os.path.join(os.path.dirname(__file__), "..", "output", file_type)
        file_path = os.path.join(base_path, filename)
        
        # Security check - ensure file is in the expected directory
        if not os.path.abspath(file_path).startswith(os.path.abspath(base_path)):
            raise HTTPException(status_code=400, detail="Invalid file path")
            
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        if filename.endswith('.csv'):
            # Read CSV file
            import pandas as pd
            df = pd.read_csv(file_path, low_memory=False)
            
            # Limit rows if specified
            if limit > 0:
                df = df.head(limit)
            
            # Convert to dict and handle NaN values
            data = df.fillna('').to_dict('records')
            
            return {
                "filename": filename,
                "type": file_type,
                "total_rows": len(df),
                "columns": list(df.columns),
                "data": data
            }
            
        elif filename.endswith('.json'):
            # Read JSON file
            import json
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return {
                "filename": filename,
                "type": file_type,
                "data": data
            }
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@app.post("/results/open-folder")
def open_results_folder():
    """
    Open the output folder in the system file explorer.
    """
    try:
        import subprocess
        import platform
        
        output_path = os.path.join(os.path.dirname(__file__), "..", "output")
        output_path = os.path.abspath(output_path)
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=404, detail="Output folder not found")
        
        system = platform.system()
        if system == "Windows":
            subprocess.run(["explorer", output_path])
        elif system == "Darwin":  # macOS
            subprocess.run(["open", output_path])
        elif system == "Linux":
            subprocess.run(["xdg-open", output_path])
        else:
            raise HTTPException(status_code=500, detail=f"Unsupported operating system: {system}")
        
        return {"status": "success", "message": "Opened output folder"}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error opening folder: {str(e)}")

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