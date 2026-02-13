import os
import json
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from .config import OPENAI_API_KEY

def _get_project_data_summary(project_id: str) -> str:
    """
    Reads the latest readings.json for the given project
    and returns a summary string.
    """
    # Assuming standard path structure: projects/{project_id}/data/readings.json
    # We need to find where 'projects' folder is relative to this file.
    # this file: services/backend/api/line/ai_service.py
    # root: services/../.. (3 levels up) -> projects is in root/projects
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    projects_dir = os.path.join(base_dir, 'projects')
    readings_path = os.path.join(projects_dir, project_id, 'data', 'readings.json')
    
    if not os.path.exists(readings_path):
        return "No real-time data available for this project yet."
        
    try:
        with open(readings_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Data format is likely: { "device_name": { "timestamp": ..., "readings": { "voltage": ..., "power": ... } } }
        # Let's summarize total power if possible, or list active devices.
        
        summary_lines = []
        total_power = 0
        device_count = 0
        
        for dev_name, info in data.items():
            device_count += 1
            readings = info.get('readings', {})
            # Try to find power (kW or W)
            # Common keys: 'kW', 'Active Power', 'Power', 'Total Active Power'
            kw = readings.get('kW') or readings.get('Active Power') or readings.get('Total Active Power') or 0
            try:
                kw_val = float(kw)
                total_power += kw_val
                summary_lines.append(f"- {dev_name}: {kw_val:.2f} kW")
            except:
                summary_lines.append(f"- {dev_name}: (No power data)")
                
        header = f"System Status for Project '{project_id}':\n"
        header += f"Active Devices: {device_count}\n"
        header += f"Total Power Usage: {total_power:.2f} kW\n"
        header += "Device Details:\n"
        
        return header + "\n".join(summary_lines[:10]) # Limit to 10 devices to save tokens
            
    except Exception as e:
        return f"Error reading system data: {str(e)}"

def get_ai_response(user_message: str, context_history: list, project_id: str = None) -> str:
    if not OPENAI_API_KEY:
        return "⚠️ AI System is not configured. Please add OPENAI_API_KEY to config.py."
    
    if not OpenAI:
        return "⚠️ OpenAI library not installed."

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        system_prompt = "You are a helpful assistant for EnergyLink (Energy Management System). You help users with their questions about energy usage, billing, and services. Be polite and concise."
        
        # Inject System Data if Project ID is known
        if project_id:
            data_summary = _get_project_data_summary(project_id)
            system_prompt += f"\n\n[CURRENT SYSTEM DATA]\n{data_summary}\n\nUse this data to answer user questions about their system status."
        else:
            system_prompt += "\n\nNote: The user has not linked a specific project yet. If they ask about their data, ask them to provide their Project ID (e.g., 'Link <ProjectID>')."

        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Append limited history
        for entry in context_history[-4:]: # Keep last 4 turns
            if 'user' in entry:
                messages.append({"role": "user", "content": entry['user']})
            if 'ai' in entry:
                messages.append({"role": "assistant", "content": entry['ai']})
        
        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"⚠️ AI Error: {str(e)}"
