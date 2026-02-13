import PyInstaller.__main__
import os
import shutil

WORK_PATH = r"c:\Users\promb\Desktop\energylink\build_temp"
DIST_PATH = r"c:\Users\promb\Desktop\energylink\desktop"
ENTRY_POINT = r"c:\Users\promb\Desktop\energylink\entry_point.py"
PROJECT_DIR = r"c:\Users\promb\Desktop\energylink"

# Clean previous build
if os.path.exists(WORK_PATH):
    shutil.rmtree(WORK_PATH)

# Ensure dist path exists
if not os.path.exists(DIST_PATH):
    os.makedirs(DIST_PATH)

print("Starting Build...")

PyInstaller.__main__.run([
    ENTRY_POINT,
    '--name=EnergyLinkBackend2',
    '--onefile',
    '--clean',
    '--noconfirm',
    f'--distpath={DIST_PATH}',
    f'--workpath={WORK_PATH}',
    f'--paths={PROJECT_DIR}',
    # Hidden imports
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=pydantic',
    '--hidden-import=jinja2',
    '--hidden-import=pandas',
    '--hidden-import=openpyxl',
    '--hidden-import=engineio.async_drivers.threading',
    '--hidden-import=services',
])

print("Build Complete.")

# Copy required asset directories next to the executable
ASSET_DIRS = [
    os.path.join(PROJECT_DIR, 'services', 'backend', 'device_templates'),
    os.path.join(PROJECT_DIR, 'services', 'backend', 'protocol'),
    os.path.join(PROJECT_DIR, 'services', 'backend', 'read_modbus'),
]

for src in ASSET_DIRS:
    if os.path.isdir(src):
        rel = os.path.relpath(src, PROJECT_DIR)
        dst = os.path.join(DIST_PATH, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copytree(src, dst, dirs_exist_ok=True)
        print(f"Copied assets: {src} -> {dst}")
    else:
        print(f"[WARN] Asset directory missing: {src}")
