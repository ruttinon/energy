import os
import json
from typing import Optional

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PROJECTS_ROOT = os.path.join(ROOT, 'projects')
TEMPLATES_ROOT = os.path.join(os.path.dirname(__file__), '..', 'device_templates')

def _config_path(project_id: str):
    return os.path.join(PROJECTS_ROOT, project_id, 'ConfigDevice.json')

def load_device_template(template_ref: str):
    try:
        if template_ref.startswith('/'):
            ref = template_ref.lstrip('/')
            tpl_path = os.path.join(ROOT, ref.replace('/', os.sep))
        else:
            tpl = template_ref if template_ref.endswith('.json') else template_ref + '.json'
            tpl_path = os.path.join(TEMPLATES_ROOT, tpl)
        with open(tpl_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] load_device_template: {str(e)}")
        return {}

def find_device(project_id: str, device_name: str):
    """หา device record จาก ConfigDevice.json"""
    try:
        cfg_path = _config_path(project_id)
        if not os.path.exists(cfg_path):
            return None
        
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        
        for converter in cfg.get('converters', []):
            for dev in (converter.get('devices') or []):
                # หาจาก name หรือ id
                if dev.get('name') == device_name or str(dev.get('id')) == str(device_name):
                    return dev
        
        return None
    except Exception as e:
        print(f"[ERROR] find_device: {str(e)}")
        return None

def get_device_registers(project_id: str, device_name: str):
    """ดึง registers list จาก device"""
    try:
        dev = find_device(project_id, device_name)
        if not dev:
            return []
        
        # ดึง template
        template_ref = dev.get('template_ref') or dev.get('template')
        if not template_ref:
            return []
        
        template = load_device_template(template_ref)
        
        # extract registers
        registers = []
        for r in (template.get('registers') or []):
            reg_name = r.get('key') or r.get('name')
            if not reg_name:
                continue
            
            registers.append({
                "name": reg_name,
                "description": r.get('description'),
                "unit": r.get('unit'),
                "address": r.get('address'),
                "datatype": r.get('datatype')
            })
        
        return registers
    
    except Exception as e:
        print(f"[ERROR] get_device_registers: {str(e)}")
        return []
