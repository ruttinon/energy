import sys
import os
import uvicorn
import multiprocessing
import threading
import subprocess
import time
import shutil

# ============================================================
# Load .env file FIRST (before any imports that read env vars)
# ============================================================
def _load_env_file():
    """Load .env file from exe directory or script directory"""
    # Determine where we are
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    
    env_path = os.path.join(base, '.env')
    if os.path.exists(env_path):
        print(f"[System] Loading .env from: {env_path}")
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        if key:
                            os.environ[key] = value
            print(f"[System] .env loaded successfully")
        except Exception as e:
            print(f"[System] Warning: Failed to load .env: {e}")
    else:
        print(f"[System] No .env file found at {env_path}")

_load_env_file()

# Ensure we can import the backend services
if getattr(sys, 'frozen', False):
    # Running in a bundle
    base_path = sys._MEIPASS
    # If running as OneFile exe, CWD remains where the exe is located
    exe_dir = os.path.dirname(sys.executable)
    
    # 🚀 PORTABILITY: Copy bundled folders to the EXE directory if they don't exist
    # This allows the EXE to be "Ready-to-run" in any folder
    for folder in ['projects', 'manager', 'services/backend/data', 'data', '.env']:
        src = os.path.join(base_path, folder)
        dst = os.path.join(exe_dir, folder)
        if os.path.exists(src) and not os.path.exists(dst):
            print(f"[System] Initializing {folder}...")
            try:
                # Create parent dirs if needed
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if os.path.isdir(src):
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
            except Exception as e:
                print(f"[System] Error copying {folder}: {e}")
else:
    # Running in a normal Python environment
    base_path = os.path.dirname(os.path.abspath(__file__))
    exe_dir = base_path
    sys.path.append(base_path)

# Import the FastAPI app
try:
    from services.backend.fastapi_app import app
except ImportError:
    # Fallback if path messing happens (e.g. inside deeply nested dir)
    sys.path.append(os.getcwd())
    from services.backend.fastapi_app import app

def find_cloudflared():
    """Find cloudflared.exe in current directory or PATH"""
    # 1. Check current directory (most likely for portable deployment)
    local_path = os.path.join(exe_dir, "cloudflared.exe")
    if os.path.exists(local_path):
        return local_path
    
    # 2. Check current working directory
    cwd_path = os.path.join(os.getcwd(), "cloudflared.exe")
    if os.path.exists(cwd_path):
        return cwd_path

    # 3. Check PATH
    path_exe = shutil.which("cloudflared")
    if path_exe:
        return path_exe
        
    return None

def run_tunnel():
    """
    Starts Cloudflare Tunnel.
    Requires 'cloudflared.exe' to be in the same folder or in PATH.
    """
    cf_exe = find_cloudflared()
    
    if not cf_exe:
        print("\n[System] ⚠️ Cloudflared.exe not found!")
        print("Please download 'cloudflared-windows-amd64.exe', rename it to 'cloudflared.exe',")
        print("and place it in the same folder as this program.")
        return

    print(f"\n[System] 🔗 Starting Cloudflare Tunnel using: {cf_exe}")
    print("[System] Generating public URL for localhost:5000...")
    
    # Run cloudflared to create a quick tunnel
    cmd = [cf_exe, "tunnel", "--url", "http://localhost:5000"]
    
    # We want to capture output to show the URL to the user, but cloudflared streams quite a bit.
    # For simplicity in this launcher, we'll let it print to stdout/stderr so the user sees the box.
    try:
        process = subprocess.Popen(cmd, stdout=sys.stdout, stderr=sys.stderr)
        process.wait()
    except Exception as e:
        print(f"[System] ❌ Cloudflare Tunnel failed: {e}")

if __name__ == '__main__':
    # PyInstaller Support
    multiprocessing.freeze_support()
    
    # Set console title
    os.system("title EnergyLink System Launcher")
    
    print("="*60)
    print("   ENERGYLINK SYSTEM LAUNCHER (Backend + Cloudflare Tunnel)   ")
    print("="*60)
    print(f"Working Directory: {os.getcwd()}")
    print(f"Executable Directory: {exe_dir}")

    # 1. Start Tunnel in Background Thread
    t = threading.Thread(target=run_tunnel)
    t.daemon = True
    t.start()
    
    # Small delay to let the tunnel initialize
    time.sleep(2)
    
    print("\n[System] 🚀 Starting Backend Server on 0.0.0.0:5000...")
    
    # 2. Start Uvicorn Server (Blocking)
    try:
        # We bind to 0.0.0.0 to allow access from other machines as well
        uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
    except Exception as e:
        print(f"\n[System] ❌ Server crashed: {e}")
    finally:
        print("\n[System] Shutting down...")
