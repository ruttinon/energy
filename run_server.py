import sys
import os
import uvicorn
import multiprocessing

# Validation: Add current directory to path so 'services' is importable
# In a PyInstaller one-file exe, sys._MEIxxxx is the temp dir, and it contains 'services' if added
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    # The 'services' package should be bundled.
    # We shouldn't need to append anything if PyInstaller does its job, 
    # BUT we might need to ensure the import works.
    pass
else:
    # Running as script
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the app factory or app object
# This ensures 'services.backend.fastapi_app' is loaded as a module
# satisfying the relative imports inside it (e.g. 'from .api ...')
from services.backend.fastapi_app import app

if __name__ == '__main__':
    # PyInstaller needs this for multiprocessing to work (if uvicorn uses it)
    multiprocessing.freeze_support()
    
    # Run Uvicorn
    # Use direct reference to 'app' object, not string "services..." to avoid import issues in EXE
    host = os.getenv("ENERGYLINK_HOST") or os.getenv("HOST") or "0.0.0.0"
    port = int(os.getenv("ENERGYLINK_PORT") or os.getenv("PORT") or "5000")
    try:
        uvicorn.run(app, host=host, port=port, log_level="info")
    except OSError as e:
        msg = str(e)
        if "10048" in msg or "Address already in use" in msg or "already in use" in msg:
            print("")
            print(f"[ERROR] Port {port} is already in use.")
            print("Close the other server using that port, or run with a different port, e.g.:")
            print("  set ENERGYLINK_PORT=5001 && python run_server.py")
            print("")
        raise
