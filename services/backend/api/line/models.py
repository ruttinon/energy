from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class LineUser(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    mode: str = "ai"  # 'ai' or 'manual'
    project_id: Optional[str] = None  # Linked project
    last_interaction: Optional[float] = None
    context_history: List[Dict[str, str]] = []  # For AI context
