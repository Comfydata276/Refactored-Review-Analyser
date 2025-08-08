#!/usr/bin/env python3
"""
Build script to create a standalone executable for the backend server.
This bundles Python + all dependencies into a single executable.
"""
import os
import subprocess
import sys
import shutil
from pathlib import Path

def run_command(cmd, check=True):
    """Run a command and print output"""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}")
    return result

def main():
    # Ensure we're in the backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    print("Building standalone backend executable...")
    
    # Install PyInstaller if not present
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        run_command(f"{sys.executable} -m pip install pyinstaller")
    
    # Clean previous builds
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    if os.path.exists("build"):
        shutil.rmtree("build")
    
    # Create version file to reduce false positives
    version_file_content = """
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
    ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'Steam Review Analyser'),
        StringStruct(u'FileDescription', u'Steam Review Analyser Backend Server'),
        StringStruct(u'FileVersion', u'1.0.0.0'),
        StringStruct(u'InternalName', u'steam-review-backend'),
        StringStruct(u'LegalCopyright', u'Copyright (c) 2025'),
        StringStruct(u'OriginalFilename', u'steam-review-backend.exe'),
        StringStruct(u'ProductName', u'Steam Review Analyser'),
        StringStruct(u'ProductVersion', u'1.0.0.0')])
      ]), 
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
"""
    
    # Write version file
    with open("version.rc", "w") as f:
        f.write(version_file_content)

    # Create the executable with better options to reduce false positives
    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",  # Create single executable
        "--noconsole",  # No console window
        "--name", "steam-review-backend",
        "--add-data", "config.yaml;.",
        "--add-data", "prompts;prompts",
        "--version-file", "version.rc",  # Add version info
        "--distpath", "../frontend/backend-dist",
        "--workpath", "build",  # Explicit work directory
        "--specpath", ".",  # Spec file location
        "--clean",  # Clean cache
        "--noconfirm",  # Don't ask for confirmation
        # Options to reduce false positives
        "--hidden-import", "uvicorn",
        "--hidden-import", "fastapi",
        "--hidden-import", "pydantic",
        "--collect-all", "uvicorn",
        "app/main.py"
    ]
    
    run_command(" ".join(pyinstaller_cmd))
    
    print("✅ Standalone backend executable created!")
    print("📁 Location: frontend/backend-dist/steam-review-backend.exe")

if __name__ == "__main__":
    main()