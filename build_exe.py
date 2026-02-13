import PyInstaller.__main__
import os
import shutil
import json

# 1. Ensure clean build (Only delete build folder, let defaults handle dist)
if os.path.exists("build"):
    try: shutil.rmtree("build") 
    except: pass
# Do NOT delete dist here if it contains our output, but standard PyInstaller uses dist/ 
# Since we moved frontend to frontend/dist, root/dist is fair game for PyInstaller.
if os.path.exists("dist"):
    try: shutil.rmtree("dist")
    except: pass

# 2. Define PyInstaller Args
args = [
    'run_server.py',  # Wrapper Entry Point
    '--name=EnergyLinkServer_v2', # New Name to avoid lock
    '--onefile', # Single EXE
    '--clean',
    
    # Include Frontend (Source : Dest) - RELIES ON frontend/dist EXISTING
    '--add-data=frontend/dist;frontend/dist',
    
    # Include Backend Data/Templates if any
    # '--add-data=services/backend/data;services/backend/data',
    
    # Hidden Imports (Common for FastAPI/Uvicorn/SQLAlchemy/Engine)
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=sqlalchemy.sql.default_comparator',
    '--hidden-import=engineio.async_drivers.asgi', # If using socketio
    '--hidden-import=python_multipart',
    
    # Bootloader ignore signals (optional)
    '--noconfirm',
]

print("Building EXE with args:", args)
PyInstaller.__main__.run(args)
print("Build Complete.")

# 3. Create Release Folder Structure
release_dir = "dist/EnergyLink_v2.0"
if os.path.exists(release_dir):
    try:
        shutil.rmtree(release_dir)
    except Exception as e:
        print(f"Warning: Could not remove old release dir: {e}")

os.makedirs(release_dir, exist_ok=True)

# Move EXE
src_exe = "dist/EnergyLinkServer_v2.exe"
dst_exe = os.path.join(release_dir, "EnergyLinkServer_v2.exe")
if os.path.exists(src_exe):
    shutil.move(src_exe, dst_exe)
    print(f"Moved EXE to {release_dir}")
else:
    print("Error: EXE not found in dist/")

# Create Data Folders
os.makedirs(os.path.join(release_dir, "projects"), exist_ok=True)

# Copy Essential Config Files (ensure backend-local active_project.json is used)
for f in ["users.json", "sessions.json"]:
    if os.path.exists(f):
        shutil.copy(f, os.path.join(release_dir, os.path.basename(f)))
        print(f"Copied {f}")

# Prefer backend's active_project.json (services/backend/active_project.json)
backend_active = os.path.join("services", "backend", "active_project.json")
if os.path.exists(backend_active):
    shutil.copy(backend_active, os.path.join(release_dir, "active_project.json"))
    print("Copied backend active_project.json")

# Copy Active Project files (based on the active_project.json we just placed in release_dir)
try:
    apath = os.path.join(release_dir, "active_project.json")
    if os.path.exists(apath):
        with open(apath, "r", encoding="utf-8") as f:
            ap = json.load(f)
            pid = ap.get("active")
            if pid and os.path.exists(os.path.join("projects", pid)):
                dest_proj = os.path.join(release_dir, "projects", pid)
                if os.path.exists(dest_proj):
                    shutil.rmtree(dest_proj)
                shutil.copytree(os.path.join("projects", pid), dest_proj)
                print(f"Copied active project: {pid}")
except Exception as e:
    print(f"Warning: Could not copy active project: {e}")

# Copy Device Templates (CRITICAL for Modbus Poller)
templates_src = "services/backend/device_templates"
templates_dst = os.path.join(release_dir, "device_templates")
if os.path.exists(templates_src):
    if os.path.exists(templates_dst):
        shutil.rmtree(templates_dst)
    shutil.copytree(templates_src, templates_dst)
    print(f"Copied device templates to {templates_dst}")
else:
    print(f"Warning: Device templates not found at {templates_src}")

# Copy Resources (images, icons)
resources_src = "resources"
resources_dst = os.path.join(release_dir, "resources")
if os.path.exists(resources_src):
    if os.path.exists(resources_dst):
        shutil.rmtree(resources_dst)
    shutil.copytree(resources_src, resources_dst)
    print(f"Copied resources to {resources_dst}")
else:
    print(f"Warning: resources not found at {resources_src}")

# Copy Helper Files if needed
#

def _write_text(p: str, s: str):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(s)

_write_text(
    os.path.join(release_dir, "START_SERVER.bat"),
    "@echo off\n"
    "setlocal\n"
    "cd /d %~dp0\n"
    "echo Starting EnergyLink backend on port 5000...\n"
    "start \"EnergyLinkServer\" \"%~dp0EnergyLinkServer_v2.exe\"\n"
    "echo Done.\n"
    "pause\n"
)

_write_text(
    os.path.join(release_dir, "CHECK_PORT_5000.bat"),
    "@echo off\n"
    "setlocal\n"
    "echo Checking TCP port 5000 listeners...\n"
    "netstat -ano | findstr :5000\n"
    "echo.\n"
    "echo If you see LISTENING on 0.0.0.0:5000, server is running.\n"
    "pause\n"
)

_write_text(
    os.path.join(release_dir, "ALLOW_PORT_5000.bat"),
    "@echo off\n"
    "setlocal\n"
    "echo Adding Windows Firewall rule for TCP 5000...\n"
    "netsh advfirewall firewall add rule name=\"EnergyLink TCP 5000\" dir=in action=allow protocol=TCP localport=5000\n"
    "echo Done.\n"
    "pause\n"
)

print(f"Portable Release created at: {os.path.abspath(release_dir)}")
print("1. Copy this folder to the server.")
print("2. Run EnergyLinkServer_v2.exe")
print("3. Data will be stored in the 'projects' folder inside.")
