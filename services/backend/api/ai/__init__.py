"""
AI Module for EnergyLink
Local AI integration using Ollama
"""

from .simple_ai_service import simple_ai_service
from .ai_router import router

__all__ = ['simple_ai_service', 'router']
