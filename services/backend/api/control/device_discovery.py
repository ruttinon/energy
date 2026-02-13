import os
import json
import sys
from typing import List, Dict, Any, Optional

# Paths
if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
    PROJECTS_ROOT = os.path.join(ROOT, 'projects')
else:
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
    PROJECTS_ROOT = os.path.join(ROOT, 'projects')

def _resolve_templates_root():
    candidates = [
        os.path.join(ROOT, 'services', 'backend', 'device_templates'),
        os.path.join(ROOT, 'device_templates'),
        os.path.join(ROOT, 'EnergyLink_v2.0', 'device_templates')
    ]
    for p in candidates:
        if os.path.isdir(p):
            return p
    return candidates[0]

DEVICE_TEMPLATES_ROOT = _resolve_templates_root()


class DeviceDiscoveryService:
    """Service to discover controllable outputs from device configurations"""
    
    def __init__(self):
        pass
    
    def _load_device_template(self, manufacturer: str, model: str) -> Optional[Dict[str, Any]]:
        """Load device template JSON file"""
        template_path = os.path.join(DEVICE_TEMPLATES_ROOT, manufacturer, f"{model}.json")
        if os.path.exists(template_path):
            try:
                with open(template_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"[DISCOVERY] Error loading template {template_path}: {e}")
        return None
    
    def get_controllable_outputs(self, manufacturer: str, model: str) -> List[Dict[str, Any]]:
        """
        Extract controllable outputs from device template.
        Returns list of outputs with their addresses and descriptions.
        """
        template = self._load_device_template(manufacturer, model)
        if not template:
            return []
        
        outputs = []
        registers = template.get('registers', [])
        
        for reg in registers:
            key = reg.get('key', '')
            # Look for digital outputs, alarm relays, or any writable coils
            if any(keyword in key.lower() for keyword in ['digital output', 'alarm relay', 'relay', 'output']):
                # Check if it's a coil (function code 1 or 5)
                if reg.get('function') in [1, 5]:
                    outputs.append({
                        'key': key,
                        'address': reg.get('address'),
                        'function': reg.get('function'),
                        'description': reg.get('description', ''),
                        'control_target': key.lower().replace(' ', '_'),
                        'write_inverted': reg.get('write_inverted', reg.get('inverted', False)),
                        'inverted': reg.get('inverted', False)
                    })
        
        return outputs
    
    def get_device_outputs(self, device_id: str) -> Dict[str, Any]:
        """
        Get controllable outputs for a specific device by ID.
        Searches through project configurations to find the device.
        """
        if not os.path.exists(PROJECTS_ROOT):
            return {'device_id': device_id, 'outputs': [], 'error': 'Projects directory not found'}
        
        # Search for device in all projects
        for project_dir in os.listdir(PROJECTS_ROOT):
            cfg_path = os.path.join(PROJECTS_ROOT, project_dir, 'ConfigDevice.json')
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        for converter in config.get('converters', []):
                            for dev in converter.get('devices', []):
                                if str(dev.get('id')) == str(device_id):
                                    # Found the device
                                    manufacturer = dev.get('manufacturer', 'unknown')
                                    model = dev.get('model', 'unknown')
                                    
                                    outputs = self.get_controllable_outputs(manufacturer, model)
                                    
                                    return {
                                        'device_id': device_id,
                                        'device_name': dev.get('name', 'Unknown'),
                                        'manufacturer': manufacturer,
                                        'model': model,
                                        'outputs': outputs,
                                        'modbus_ip': dev.get('modbus_ip') or converter['settings']['host'],
                                        'modbus_port': dev.get('modbus_port') or converter['settings']['port'],
                                        'modbus_slave': dev.get('modbus_slave', 1)
                                    }
                except Exception as e:
                    print(f"[DISCOVERY] Error reading config {cfg_path}: {e}")
                    continue
        
        return {'device_id': device_id, 'outputs': [], 'error': 'Device not found'}
    
    def list_all_controllable_devices(self, project_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all devices with controllable outputs.
        If project_name is specified, only return devices from that project.
        """
        devices = []
        
        if not os.path.exists(PROJECTS_ROOT):
            return devices
        
        project_dirs = [project_name] if project_name else os.listdir(PROJECTS_ROOT)
        
        for project_dir in project_dirs:
            cfg_path = os.path.join(PROJECTS_ROOT, project_dir, 'ConfigDevice.json')
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        for converter in config.get('converters', []):
                            for dev in converter.get('devices', []):
                                manufacturer = dev.get('manufacturer', 'unknown')
                                model = dev.get('model', 'unknown')
                                outputs = self.get_controllable_outputs(manufacturer, model)
                                
                                if outputs:  # Only include devices with controllable outputs
                                    devices.append({
                                        'device_id': str(dev.get('id')),
                                        'device_name': dev.get('name', 'Unknown'),
                                        'manufacturer': manufacturer,
                                        'model': model,
                                        'project': project_dir,
                                        'output_count': len(outputs),
                                        'outputs': outputs
                                    })
                except Exception as e:
                    print(f"[DISCOVERY] Error reading config {cfg_path}: {e}")
                    continue
        
        return devices


# Singleton instance
device_discovery_service = DeviceDiscoveryService()
