import sys
import os
import uvicorn
import sys
import os
import uvicorn
import multiprocessing

# Add the directory containing 'services' to sys.path
# In development, this is the current directory.
# In PyInstaller, we rely on the bundled files.
if getattr(sys, 'frozen', False):
    # If frozen, the files are in sys._MEIPASS or standard path
    pass
else:
    # Add project root to sys.path to allow imports like 'services.backend...'
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    if root_dir not in sys.path:
        sys.path.insert(0, root_dir)

# Force imports for PyInstaller detection
try:
    # import services.backend.api.xlsx_storage # REMOVED
    import services.backend.api.trend_api
    import services.backend.api.history_api
    import services.backend.api.alert_module.alert_engine
    import services.backend.api.alert_module.alert_routes
    import services.backend.api.photoview.photoview_router
    import services.backend.api.report_builder.report_router
    import services.backend.api.billing.billing_router
    import services.backend.api.billing.billing_service
    import services.backend.api.report_builder.template_router
except ImportError:
    pass

from services.backend.fastapi_app import app

if __name__ == "__main__":
    multiprocessing.freeze_support()
    # Run server
    port = int(os.environ.get("ENERGYLINK_PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
