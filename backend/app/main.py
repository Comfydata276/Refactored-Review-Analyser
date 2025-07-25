from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.config_manager import ConfigManager

app = FastAPI(title="Steam Review Analyser API")

# Allow Electron/Dev React to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate your existing config manager
config_mgr = ConfigManager(
    config_path="config.yaml",
    env_path=".env"
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/config")
def read_config():
    # return the full in-memory config
    return config_mgr.config

@app.post("/config")
def write_config(payload: dict):
    # merge top-level keys & persist
    config_mgr.config.update(payload)
    config_mgr.save_config()
    return {"status": "saved"}

@app.get("/config/setting")
def get_setting(path: str, default: str = None):
    # path="analysis.reviews_to_analyze"
    keys = path.split(".")
    val = config_mgr.get_setting(keys, default)
    if val is None:
        raise HTTPException(404, f"Setting {path} not found")
    return {"value": val}

@app.post("/config/setting")
def set_setting(path: str, value: str):
    keys = path.split(".")
    config_mgr.set_setting(keys, value)
    config_mgr.save_config()
    return {"status": "updated", "path": path, "value": value}