"""
User Preferences Management for LINE Bot
"""
import json
import os
from pathlib import Path
from typing import Dict, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class UserPreferences:
    """Manage user preferences for LINE Bot"""
    
    def __init__(self):
        self.preferences_file = Path(__file__).parent.parent.parent.parent.parent / "data" / "user_preferences.json"
        self.preferences: Dict[str, Dict] = {}
        self._load_preferences()
    
    def _load_preferences(self):
        """Load user preferences from file"""
        try:
            if self.preferences_file.exists():
                with open(self.preferences_file, 'r', encoding='utf-8') as f:
                    self.preferences = json.load(f)
                logger.info(f"Loaded preferences for {len(self.preferences)} users")
        except Exception as e:
            logger.error(f"Error loading preferences: {e}")
            self.preferences = {}
    
    def _save_preferences(self):
        """Save user preferences to file"""
        try:
            # Ensure data directory exists
            self.preferences_file.parent.mkdir(exist_ok=True)
            
            with open(self.preferences_file, 'w', encoding='utf-8') as f:
                json.dump(self.preferences, f, ensure_ascii=False, indent=2)
            logger.info("Saved user preferences")
        except Exception as e:
            logger.error(f"Error saving preferences: {e}")
    
    def set_user_project(self, user_id: str, project_id: str):
        """Set user's preferred project"""
        if user_id not in self.preferences:
            self.preferences[user_id] = {}
        
        self.preferences[user_id]['selected_project'] = project_id
        self.preferences[user_id]['last_updated'] = str(datetime.now())
        self._save_preferences()
        
        logger.info(f"User {user_id} selected project {project_id}")

    def set_user_mode(self, user_id: str, mode: str):
        """Set user's mode (ai/manual)"""
        if user_id not in self.preferences:
            self.preferences[user_id] = {}
            
        self.preferences[user_id]['mode'] = mode
        self.preferences[user_id]['last_updated'] = str(datetime.now())
        self._save_preferences()
        logger.info(f"User {user_id} switched to mode {mode}")

    def get_user_mode(self, user_id: str) -> str:
        """Get user's mode (default: ai)"""
        return self.preferences.get(user_id, {}).get('mode', 'ai')
    
    def get_user_project(self, user_id: str) -> Optional[str]:
        """Get user's preferred project"""
        return self.preferences.get(user_id, {}).get('selected_project')
    
    def get_all_users_for_project(self, project_id: str) -> list:
        """Get all users who have selected this project"""
        users = []
        for user_id, prefs in self.preferences.items():
            stored_proj = prefs.get('selected_project')
            if stored_proj and str(stored_proj).lower() == str(project_id).lower():
                users.append(user_id)
        return users

# Global instance
user_preferences = UserPreferences()
