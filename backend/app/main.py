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

# ── Prompt Management Endpoints ────────────────────────────────────────────
from pydantic import BaseModel
from fastapi import UploadFile, File
import json
from datetime import datetime

class PromptRequest(BaseModel):
    content: str

class PromptSelectRequest(BaseModel):
    filename: str

@app.get("/prompts")
def list_prompts():
    """List all available prompt files in the prompts directory."""
    try:
        prompts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))
        
        # Ensure prompts directory exists
        if not os.path.exists(prompts_dir):
            os.makedirs(prompts_dir)
            return {"prompts": [], "active_prompt": "prompt.txt"}
        
        # Get current active prompt file
        active_prompt = config_mgr.get_setting(["analysis", "prompt_file"], "prompt.txt")
        
        # List all .txt files in prompts directory
        prompt_files = []
        for filename in os.listdir(prompts_dir):
            if filename.endswith('.txt'):
                file_path = os.path.join(prompts_dir, filename)
                file_stats = os.stat(file_path)
                
                # Read first few lines to get a preview
                preview = ""
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        preview = ''.join(lines[:3]).strip()
                        if len(lines) > 3:
                            preview += "..."
                except:
                    preview = "Unable to read file"
                
                prompt_files.append({
                    "filename": filename,
                    "size": file_stats.st_size,
                    "modified": file_stats.st_mtime,
                    "preview": preview[:100],  # Limit preview to 100 chars
                    "is_active": filename == active_prompt
                })
        
        # Sort by modification time (newest first)
        prompt_files.sort(key=lambda x: x["modified"], reverse=True)
        
        return {"prompts": prompt_files, "active_prompt": active_prompt}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing prompts: {str(e)}")

@app.get("/prompt")
def get_prompt():
    """Get the current analysis prompt content."""
    try:
        # Get prompt filename from config (defaults to 'prompt.txt')
        prompt_filename = config_mgr.get_setting(["analysis", "prompt_file"], "prompt.txt")
        
        # Try explicit path from config (deprecated but still supported)
        prompt_path = config_mgr.get_setting(["analysis", "prompt_file_path"], None)
        
        # If explicit path not set, use filename with prompts directory
        if not prompt_path:
            prompt_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "prompts", prompt_filename)
            )
        
        # Read the prompt file
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                content = f.read()
        except FileNotFoundError:
            content = "Default prompt: Analyse this text for sentiment."
            
        return {"content": content, "path": prompt_path, "filename": prompt_filename}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading prompt: {str(e)}")

@app.post("/prompt")
def save_prompt(request: PromptRequest):
    """Save the analysis prompt content to the currently active prompt file."""
    try:
        # Get prompt filename from config (defaults to 'prompt.txt')
        prompt_filename = config_mgr.get_setting(["analysis", "prompt_file"], "prompt.txt")
        
        # Try explicit path from config (deprecated but still supported)
        prompt_path = config_mgr.get_setting(["analysis", "prompt_file_path"], None)
        
        # If explicit path not set, use filename with prompts directory
        if not prompt_path:
            prompt_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "prompts", prompt_filename)
            )
        
        # Save the prompt file
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(request.content)
            
        return {"status": "saved", "path": prompt_path, "filename": prompt_filename}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving prompt: {str(e)}")

@app.post("/prompt/select")
def select_prompt(request: PromptSelectRequest):
    """Set the active prompt file."""
    try:
        prompts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))
        prompt_path = os.path.join(prompts_dir, request.filename)
        
        # Validate the file exists and is in the prompts directory
        if not os.path.abspath(prompt_path).startswith(os.path.abspath(prompts_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")
            
        if not os.path.exists(prompt_path):
            raise HTTPException(status_code=404, detail="Prompt file not found")
            
        if not request.filename.endswith('.txt'):
            raise HTTPException(status_code=400, detail="Only .txt files are supported")
        
        # Update the config
        config_mgr.config.setdefault("analysis", {})["prompt_file"] = request.filename
        config_mgr.save_config()
        
        return {"status": "selected", "filename": request.filename}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error selecting prompt: {str(e)}")

@app.post("/prompt/upload")
def upload_prompt(file: UploadFile = File(...)):
    """Upload a new prompt file."""
    try:
        # Validate file type
        if not file.filename or not file.filename.endswith('.txt'):
            raise HTTPException(status_code=400, detail="Only .txt files are supported")
        
        # Sanitize filename
        import re
        safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', file.filename)
        
        prompts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))
        
        # Ensure prompts directory exists
        if not os.path.exists(prompts_dir):
            os.makedirs(prompts_dir)
        
        file_path = os.path.join(prompts_dir, safe_filename)
        
        # Check if file already exists
        if os.path.exists(file_path):
            # Create a unique filename
            base, ext = os.path.splitext(safe_filename)
            counter = 1
            while os.path.exists(file_path):
                safe_filename = f"{base}_{counter}{ext}"
                file_path = os.path.join(prompts_dir, safe_filename)
                counter += 1
        
        # Save the uploaded file
        with open(file_path, "wb") as f:
            content = file.file.read()
            f.write(content)
        
        return {"status": "uploaded", "filename": safe_filename, "path": file_path}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading prompt: {str(e)}")

@app.delete("/prompt/{filename}")
def delete_prompt(filename: str):
    """Delete a prompt file."""
    try:
        # Don't allow deletion of the default prompt file
        if filename == "prompt.txt":
            raise HTTPException(status_code=400, detail="Cannot delete the default prompt file")
        
        prompts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))
        file_path = os.path.join(prompts_dir, filename)
        
        # Validate the file path
        if not os.path.abspath(file_path).startswith(os.path.abspath(prompts_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")
            
        if not filename.endswith('.txt'):
            raise HTTPException(status_code=400, detail="Only .txt files can be deleted")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Prompt file not found")
        
        # If this was the active prompt, switch to default
        current_active = config_mgr.get_setting(["analysis", "prompt_file"], "prompt.txt")
        if current_active == filename:
            config_mgr.config.setdefault("analysis", {})["prompt_file"] = "prompt.txt"
            config_mgr.save_config()
        
        # Delete the file
        os.remove(file_path)
        
        return {"status": "deleted", "filename": filename}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting prompt: {str(e)}")

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

# ── API Key Management Endpoints ──────────────────────────────────────────
@app.get("/api-keys")
def get_api_keys():
    """
    Get all API keys (returns masked versions for security).
    Returns JSON: { provider_name: "sk-***" }
    """
    try:
        api_keys = config_mgr.list_env_api_keys()
        # Mask the keys for security
        masked_keys = {}
        for provider, key in api_keys.items():
            if key and len(key) > 8:
                masked_keys[provider] = key[:4] + "*" * (len(key) - 8) + key[-4:]
            elif key:
                masked_keys[provider] = "*" * len(key)
            else:
                masked_keys[provider] = ""
        
        return {"status": "success", "api_keys": masked_keys}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading API keys: {str(e)}")

@app.post("/api-keys/{provider}")
def set_api_key(provider: str, payload: dict):
    """
    Set an API key for a specific provider.
    Body JSON: { "api_key": "your-key-here" }
    """
    try:
        if "api_key" not in payload:
            raise HTTPException(status_code=400, detail="Missing 'api_key' field")
        
        api_key = payload["api_key"].strip()
        if not api_key:
            raise HTTPException(status_code=400, detail="API key cannot be empty")
        
        # Valid providers
        valid_providers = ["openai", "gemini", "claude", "anthropic"]
        if provider.lower() not in valid_providers:
            raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {valid_providers}")
        
        # Use ConfigManager's secure API key method
        config_mgr.set_api_key(provider.lower(), api_key)
        
        return {"status": "success", "message": f"API key for {provider} saved securely"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving API key: {str(e)}")

@app.delete("/api-keys/{provider}")
def remove_api_key(provider: str):
    """
    Remove an API key for a specific provider.
    """
    try:
        valid_providers = ["openai", "gemini", "claude", "anthropic"]
        if provider.lower() not in valid_providers:
            raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {valid_providers}")
        
        # Use ConfigManager's secure API key method
        config_mgr.remove_api_key(provider.lower())
        
        return {"status": "success", "message": f"API key for {provider} removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing API key: {str(e)}")

# ── LLM Management Endpoints ──────────────────────────────────────────────
@app.get("/llm/ollama/models")
def get_ollama_models():
    """
    Get list of installed Ollama models using CLI command.
    Returns JSON: { status: str, models: [ {name, id, size, modified} ] }
    """
    try:
        import subprocess
        import json
        import requests
        
        # Method 1: Try API endpoint first (more reliable)
        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                api_models = data.get('models', [])
                models = []
                for model in api_models:
                    models.append({
                        'name': model.get('name', ''),
                        'id': model.get('digest', '')[:12] if model.get('digest') else '',
                        'size': f"{model.get('size', 0) / (1024**3):.1f} GB" if model.get('size') else 'Unknown',
                        'modified': model.get('modified_at', '').split('T')[0] if model.get('modified_at') else 'Unknown'
                    })
                return {
                    "status": "success",
                    "source": "api",
                    "models": models
                }
        except (requests.RequestException, json.JSONDecodeError):
            pass  # Fall back to CLI method
        
        # Method 2: Fallback to CLI command
        try:
            result = subprocess.run(['ollama', 'list'], 
                                  capture_output=True, 
                                  text=True, 
                                  check=True,
                                  timeout=10)
            
            # Parse CLI output (skip header line)
            lines = result.stdout.strip().split('\n')
            if len(lines) <= 1:  # Only header or empty
                return {
                    "status": "success", 
                    "source": "cli",
                    "models": []
                }
            
            models = []
            for line in lines[1:]:  # Skip header
                parts = line.split()
                if len(parts) >= 4:
                    models.append({
                        'name': parts[0],
                        'id': parts[1],
                        'size': parts[2],
                        'modified': ' '.join(parts[3:])
                    })
            
            return {
                "status": "success",
                "source": "cli", 
                "models": models
            }
            
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
            return {
                "status": "error",
                "message": f"Ollama CLI error: {str(e)}",
                "models": []
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error discovering Ollama models: {str(e)}")

@app.post("/llm/ollama/refresh")
def refresh_ollama_models():
    """
    Refresh the list of available Ollama models in config.
    Updates config.yaml with discovered models.
    """
    try:
        # Get current models from Ollama
        models_response = get_ollama_models()
        
        if models_response["status"] != "success":
            raise HTTPException(status_code=500, detail=models_response.get("message", "Failed to get Ollama models"))
        
        discovered_models = models_response["models"]
        model_names = [model["name"] for model in discovered_models]
        
        # Update configuration
        current_ollama_config = config_mgr.get_setting(['llm_providers', 'ollama'], {})
        
        # Convert model names to the expected format for config
        available_models = []
        for name in model_names:
            available_models.append({
                'display_name': name,
                'api_name': name,
                'tags': ['General'],  # Default tag for Ollama models
                'enabled': True
            })
        
        # Update the config
        updated_config = {
            **current_ollama_config,
            'available_models': available_models,
            'enabled': len(available_models) > 0  # Auto-enable if models found
        }
        
        # Preserve existing enabled_models or default to all discovered
        if 'enabled_models' not in current_ollama_config:
            updated_config['enabled_models'] = model_names
        
        # Save to config
        config_mgr.config.setdefault('llm_providers', {})['ollama'] = updated_config
        config_mgr.save_config()
        
        return {
            "status": "success",
            "message": f"Discovered and configured {len(model_names)} Ollama models",
            "models": model_names,
            "source": models_response["source"]
        }
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error refreshing Ollama models: {str(e)}")

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