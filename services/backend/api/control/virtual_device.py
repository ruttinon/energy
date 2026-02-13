"""
Virtual Device Simulator for CVM-C11
Simulates digital outputs in memory for testing without physical hardware
"""

import threading
from typing import Dict, Optional
from datetime import datetime

class VirtualDeviceSimulator:
    """Simulates CVM-C11 digital outputs in memory"""
    
    def __init__(self):
        self._devices: Dict[str, Dict[int, int]] = {}  # {device_id: {address: value}}
        self._lock = threading.Lock()
    
    def write_coil(self, device_id: str, address: int, value: int) -> bool:
        """
        Simulate writing a coil
        Returns True on success
        """
        with self._lock:
            if device_id not in self._devices:
                self._devices[device_id] = {}
            
            # Convert value to 0 or 1
            self._devices[device_id][address] = 1 if value else 0
            
            print(f"[VIRTUAL] Device {device_id} Address {address} = {self._devices[device_id][address]}")
            return True
    
    def read_coil(self, device_id: str, address: int) -> Optional[int]:
        """
        Simulate reading a coil
        Returns 0, 1, or None if not set
        """
        with self._lock:
            if device_id in self._devices and address in self._devices[device_id]:
                return self._devices[device_id][address]
            return 0  # Default to OFF if never written
    
    def get_all_coils(self, device_id: str) -> Dict[int, int]:
        """Get all coil states for a device"""
        with self._lock:
            return self._devices.get(device_id, {}).copy()
    
    def reset_device(self, device_id: str):
        """Reset all coils for a device to OFF"""
        with self._lock:
            if device_id in self._devices:
                self._devices[device_id] = {}

# Global simulator instance
virtual_device = VirtualDeviceSimulator()
