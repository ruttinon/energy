import os
from pathlib import Path

# ============================================================
# Load .env file from project root (if it exists)
# ============================================================
_env_path = Path(__file__).parent.parent.parent.parent.parent / ".env"
if _env_path.exists():
    try:
        with open(_env_path, 'r', encoding='utf-8') as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _key, _value = _line.split('=', 1)
                    _key = _key.strip()
                    _value = _value.strip()
                    if _key and _key not in os.environ:
                        os.environ[_key] = _value
    except Exception as e:
        print(f"[LINE Config] Failed to load .env: {e}")

# Server Configuration
BASE_URL = "http://61.91.56.190:5000"  # Updated based on user input

# LINE Configuration (use .env values with hardcoded fallback)
LINE_CHANNEL_ACCESS_TOKEN = os.getenv(
    "LINE_CHANNEL_ACCESS_TOKEN",
    "Ku5FRA9hyENkCYAXyyLSqLwKTPvwrc231D0gnh3TtJoOfR1l+zyoxBcbJzxxOQGwGbk1m3DPH3kCNs/RbhHfxBsa+9EEEslAmP8UK6/WnEsSIN9QrvfnKZi0eQKA6lt4uBK4y/SIY9PNEVXm2/R+HQdB04t89/1O/w1cDnyilFU="
)
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "7738f0dfd5bf2b7408d4959b979e74f5")

# Debug: Print loaded values (masked)
print(f"[LINE Config] Token loaded: ...{LINE_CHANNEL_ACCESS_TOKEN[-20:]}")
print(f"[LINE Config] Secret loaded: {'***' + LINE_CHANNEL_SECRET[-8:] if LINE_CHANNEL_SECRET else 'EMPTY!'}")

# AI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Data Storage
LINE_DATA_DIR = os.path.join("services", "backend", "data", "line")
LINE_USERS_FILE = os.path.join(LINE_DATA_DIR, "users.json")
