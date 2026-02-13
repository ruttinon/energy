"""
LINE Bot Configuration
"""
import os
from dataclasses import dataclass
from pathlib import Path

@dataclass
class LineConfig:
    """LINE Bot configuration settings"""
    channel_access_token: str
    channel_secret: str
    
    @classmethod
    def from_env(cls):
        """Load configuration from environment variables"""
        # Try to load from .env file in project root
        env_path = Path(__file__).parent.parent.parent.parent.parent / ".env"
        if env_path.exists():
            with open(env_path, 'r') as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value
        
        return cls(
            channel_access_token=os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "Ku5FRA9hyENkCYAXyyLSqLwKTPvwrc231D0gnh3TtJoOfR1l+zyoxBcbJzxxOQGwGbk1m3DPH3kCNs/RbhHfxBsa+9EEEslAmP8UK6/WnEsSIN9QrvfnKZi0eQKA6lt4uBK4y/SIY9PNEVXm2/R+HQdB04t89/1O/w1cDnyilFU="),
            channel_secret=os.getenv("LINE_CHANNEL_SECRET", "7738f0dfd5bf2b7408d4959b979e74f5")
        )
    
    def validate(self):
        """Validate required configuration"""
        if not self.channel_access_token:
            raise ValueError("LINE_CHANNEL_ACCESS_TOKEN is required")
        # channel_secret optional for debug/tunnel environments
