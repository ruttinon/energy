import os
import json
import sqlite3
import struct
import socket
import time
from datetime import datetime
from typing import Optional, Dict, Any

from .models import ControlDescriptor, AuditLogEntry, ControlConfig
from .device_discovery import device_discovery_service

# Try importing virtual device simulator
try:
    from .virtual_device import virtual_device
except ImportError:
    virtual_device = None

# Try importing pymodbus
try:
    from pymodbus.client.sync import ModbusTcpClient
except ImportError:
    try:
        from pymodbus.client import ModbusTcpClient
    except Exception:
        ModbusTcpClient = None

# Paths
# Paths
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
PROJECTS_ROOT = os.path.join(ROOT, 'projects')

from services.backend.api.billing.database import get_project_db_path

class ControlService:
    def __init__(self):
        # No global init anymore
        pass
    
    def _find_parent_protocol(self, parent_id: int) -> str:
        try:
            if not os.path.exists(PROJECTS_ROOT):
                return "modbus_tcp"
            for project_dir in os.listdir(PROJECTS_ROOT):
                cfg_path = os.path.join(PROJECTS_ROOT, project_dir, 'ConfigDevice.json')
                if not os.path.exists(cfg_path):
                    continue
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                for conv in cfg.get('converters', []):
                    if int(conv.get('id')) == int(parent_id):
                        return (conv.get('protocol') or 'modbus_tcp').lower()
        except Exception as e:
            print(f"[CONTROL] _find_parent_protocol error: {e}")
        return "modbus_tcp"

    def _ensure_audit_table(self, project_id: str):
        """Initialize Audit Log Table in Project DB"""
        if not project_id: return
        try:
            db_path = get_project_db_path(project_id)
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT,
                control_mode TEXT,
                control_target TEXT,
                action TEXT,
                reason TEXT,
                operator TEXT,
                status TEXT,
                error_message TEXT,
                executed_at TEXT
            )
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[CONTROL] Failed to init audit table for {project_id}: {e}")

    def _log_audit(self, entry: AuditLogEntry):
        """Write to Project SQLite Audit Log"""
        project_id = getattr(entry, 'project_id', None)
        if not project_id:
            # Try to infer or skip?
            # Ideally we want to log even if project_id is missing, but where?
            # For now, let's print a warning and skip, or use a default 'unknown' project?
            # Better: The router should have populated it.
            print(f"[CONTROL] ⚠️ Audit log skipped: No project_id found for action on {entry.device_id}")
            return

        try:
            self._ensure_audit_table(project_id)
            db_path = get_project_db_path(project_id)
            conn = sqlite3.connect(db_path, check_same_thread=False)
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO control_audit 
            (device_id, control_mode, control_target, action, reason, operator, status, error_message, executed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                entry.device_id, entry.control_mode, entry.control_target, entry.action, 
                entry.reason, entry.operator, entry.status, entry.error_message, 
                entry.executed_at.isoformat()
            ))
            conn.commit()
            conn.close()
            print(f"[CONTROL] ✅ Audit Logged for project {project_id}")
        except Exception as e:
            print(f"[CONTROL] Audit Log Error: {e}")

    def _find_device_config(self, device_id: str) -> Optional[Dict[str, Any]]:
        """
        Locate device configuration across all projects.
        In a real system, you might have a better index.
        Here we scan ConfigDevice.json in active projects.
        """
        # This is a simplified lookup. Ideally, we should pass project_id.
        # For now, we search all projects in `projects/`
        if not os.path.exists(PROJECTS_ROOT):
            return None
            
        for project_dir in os.listdir(PROJECTS_ROOT):
            cfg_path = os.path.join(PROJECTS_ROOT, project_dir, 'ConfigDevice.json')
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        for converter in config.get('converters', []):
                            # Check devices attached to converter
                            for dev in converter.get('devices', []):
                                if str(dev.get('id')) == str(device_id):
                                    # Merge converter settings (IP/Port)
                                    dev['modbus_ip'] = dev.get('modbus_ip') or converter['settings']['host']
                                    dev['modbus_port'] = dev.get('modbus_port') or converter['settings']['port']
                                    return dev
                except Exception:
                    continue
        return None

    def _write_modbus_old(self, ip: str, port: int, slave: int, address: int, value: int, function: int = 5, protocol: str = "modbus_tcp") -> bool:
        """
        Execute Modbus Write Command with Retry (3 Attempts)
        """
        for attempt in range(1, 4):
            try:
                print(f"[CONTROL] Write Attempt {attempt}/3: {ip}:{port} S{slave} A{address} V{hex(value)} F{function}")
                
                # 1. RTU over TCP
                if protocol == "tcp":
                    try:
                        payload = struct.pack(">B B H H", slave, function, address, value)
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1: crc = (crc >> 1) ^ 0xA001
                                else: crc >>= 1
                        frame = payload + struct.pack("<H", crc)
                        
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(3.0)
                        s.connect((ip, port))
                        s.send(frame)
                        resp = s.recv(1024)
                        s.close()
                        
                        if len(resp) >= 5:
                            r_slave, r_func = struct.unpack(">B B", resp[:2])
                            if r_slave == slave and r_func == function:
                                return True
                    except Exception as e:
                        print(f"[CONTROL] RTU Write Error: {e}")

                # 2. Modbus TCP (Pymodbus)
                if ModbusTcpClient and protocol == "modbus_tcp":
                    try:
                        client = ModbusTcpClient(ip, port=port, timeout=3.0)
                        if client.connect():
                            rr = None
                            if function == 5:
                                rr = client.write_coil(address, value == 0xFF00, slave=slave)
                            elif function == 6:
                                rr = client.write_register(address, value, slave=slave)
                            client.close()
                            if rr and not rr.isError():
                                return True
                    except Exception as e:
                        print(f"[CONTROL] Pymodbus Write Error: {e}")

                # 3. Raw Socket Fallback
                try:
                    tid = int(time.time() * 1000) & 0xFFFF
                    pdu = struct.pack(">B B H H", slave, function, address, value)
                    mbap = struct.pack(">H H H", tid, 0, len(pdu))
                    req = mbap + pdu
                    
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(3.0)
                    s.connect((ip, port))
                    s.send(req)
                    resp = s.recv(1024)
                    s.close()
                    
                    if len(resp) >= 9:
                        r_tid, _, _, _, r_func = struct.unpack(">H H H B B", resp[:8])
                        if r_tid == tid and r_func == function:
                            return True
                except Exception as e:
                    print(f"[CONTROL] Raw Write Error: {e}")

            except Exception as e:
                print(f"[CONTROL] Write Error: {e}")
            
            time.sleep(0.5)
        
        return False

        """
        Execute Modbus Write Command with Retry (3 Attempts)
        """
        for attempt in range(1, 4):
            try:
                print(f"[CONTROL] Write Attempt {attempt}/3: {ip}:{port} S{slave} A{address} V{hex(value)} F{function}")
                
                # 1. RTU over TCP
                if protocol == "tcp":
                    try:
                        payload = struct.pack(">B B H H", slave, function, address, value)
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1: crc = (crc >> 1) ^ 0xA001
                                else: crc >>= 1
                        frame = payload + struct.pack("<H", crc)
                        
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(3.0)
                        s.connect((ip, port))
                        s.send(frame)
                        resp = s.recv(1024)
                        s.close()
                        
                        if len(resp) >= 5:
                            r_slave, r_func = struct.unpack(">B B", resp[:2])
                            if r_slave == slave and r_func == function:
                                return True
                    except Exception as e:
                        print(f"[CONTROL] RTU Write Error: {e}")

                # 2. Modbus TCP (Pymodbus)
                if ModbusTcpClient and protocol == "modbus_tcp":
                    try:
                        client = ModbusTcpClient(ip, port=port, timeout=3.0)
                        if client.connect():
                            rr = None
                            if function == 5:
                                rr = client.write_coil(address, value == 0xFF00, slave=slave)
                            elif function == 6:
                                rr = client.write_register(address, value, slave=slave)
                            client.close()
                            if rr and not rr.isError():
                                return True
                    except Exception as e:
                        print(f"[CONTROL] Pymodbus Write Error: {e}")

                # 3. Raw Socket Fallback
                try:
                    tid = int(time.time() * 1000) & 0xFFFF
                    pdu = struct.pack(">B B H H", slave, function, address, value)
                    mbap = struct.pack(">H H H", tid, 0, len(pdu))
                    req = mbap + pdu
                    
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(3.0)
                    s.connect((ip, port))
                    s.send(req)
                    resp = s.recv(1024)
                    s.close()
                    
                    if len(resp) >= 9:
                        r_tid, _, _, _, r_func = struct.unpack(">H H H B B", resp[:8])
                        if r_tid == tid and r_func == function:
                            return True
                except Exception as e:
                    print(f"[CONTROL] Raw Write Error: {e}")

            except Exception as e:
                print(f"[CONTROL] Write Error: {e}")
            
            time.sleep(0.5)
        
        return False

        """
        Execute Modbus Write Command with Retry (3 Attempts)
        """
        for attempt in range(1, 4):
            try:
                print(f"[CONTROL] Write Attempt {attempt}/3: {ip}:{port} S{slave} A{address} V{hex(value)} F{function}")
                
                # 1. RTU over TCP
                if protocol == "tcp":
                    try:
                        payload = struct.pack(">B B H H", slave, function, address, value)
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1: crc = (crc >> 1) ^ 0xA001
                                else: crc >>= 1
                        frame = payload + struct.pack("<H", crc)
                        
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(3.0)
                        s.connect((ip, port))
                        s.send(frame)
                        resp = s.recv(1024)
                        s.close()
                        
                        if len(resp) >= 5:
                            r_slave, r_func = struct.unpack(">B B", resp[:2])
                            if r_slave == slave and r_func == function:
                                return True
                    except Exception as e:
                        print(f"[CONTROL] RTU Write Error: {e}")

                # 2. Modbus TCP (Pymodbus)
                if ModbusTcpClient and protocol == "modbus_tcp":
                    try:
                        client = ModbusTcpClient(ip, port=port, timeout=3.0)
                        if client.connect():
                            rr = None
                            if function == 5:
                                rr = client.write_coil(address, value == 0xFF00, slave=slave)
                            elif function == 6:
                                rr = client.write_register(address, value, slave=slave)
                            client.close()
                            if rr and not rr.isError():
                                return True
                    except Exception as e:
                        print(f"[CONTROL] Pymodbus Write Error: {e}")

                # 3. Raw Socket Fallback
                try:
                    tid = int(time.time() * 1000) & 0xFFFF
                    pdu = struct.pack(">B B H H", slave, function, address, value)
                    mbap = struct.pack(">H H H", tid, 0, len(pdu))
                    req = mbap + pdu
                    
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(3.0)
                    s.connect((ip, port))
                    s.send(req)
                    resp = s.recv(1024)
                    s.close()
                    
                    if len(resp) >= 9:
                        r_tid, _, _, _, r_func = struct.unpack(">H H H B B", resp[:8])
                        if r_tid == tid and r_func == function:
                            return True
                except Exception as e:
                    print(f"[CONTROL] Raw Write Error: {e}")

            except Exception as e:
                print(f"[CONTROL] Write Error: {e}")
            
            time.sleep(0.5)
        
        return False

        """
        Execute Modbus Write Command with Retry (3 Attempts)
        """
        for attempt in range(1, 4):
            try:
                print(f"[CONTROL] Write Attempt {attempt}/3: {ip}:{port} S{slave} A{address} V{hex(value)} F{function}")
                
                # 1. RTU over TCP
                if protocol == "tcp":
                    try:
                        payload = struct.pack(">B B H H", slave, function, address, value)
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1: crc = (crc >> 1) ^ 0xA001
                                else: crc >>= 1
                        frame = payload + struct.pack("<H", crc)
                        
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(3.0)
                        s.connect((ip, port))
                        s.send(frame)
                        resp = s.recv(1024)
                        s.close()
                        
                        if len(resp) >= 5:
                            r_slave, r_func = struct.unpack(">B B", resp[:2])
                            if r_slave == slave and r_func == function:
                                return True
                    except Exception as e:
                        print(f"[CONTROL] RTU Write Error: {e}")

                # 2. Modbus TCP (Pymodbus)
                if ModbusTcpClient and protocol == "modbus_tcp":
                    try:
                        client = ModbusTcpClient(ip, port=port, timeout=3.0)
                        if client.connect():
                            rr = None
                            if function == 5:
                                rr = client.write_coil(address, value == 0xFF00, slave=slave)
                            elif function == 6:
                                rr = client.write_register(address, value, slave=slave)
                            client.close()
                            if rr and not rr.isError():
                                return True
                    except Exception as e:
                        print(f"[CONTROL] Pymodbus Write Error: {e}")

                # 3. Raw Socket Fallback
                try:
                    tid = int(time.time() * 1000) & 0xFFFF
                    pdu = struct.pack(">B B H H", slave, function, address, value)
                    mbap = struct.pack(">H H H", tid, 0, len(pdu))
                    req = mbap + pdu
                    
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(3.0)
                    s.connect((ip, port))
                    s.send(req)
                    resp = s.recv(1024)
                    s.close()
                    
                    if len(resp) >= 9:
                        r_tid, _, _, _, r_func = struct.unpack(">H H H B B", resp[:8])
                        if r_tid == tid and r_func == function:
                            return True
                except Exception as e:
                    print(f"[CONTROL] Raw Write Error: {e}")

            except Exception as e:
                print(f"[CONTROL] Write Error: {e}")
            
            time.sleep(0.5)
        
        return False

        """
        Execute Modbus Write Command.
        Function 5: Write Single Coil (0xFF00 = ON, 0x0000 = OFF)
        Function 6: Write Single Register
        """
        print(f"[CONTROL] Writing Modbus: {ip}:{port} Slave={slave} Addr={address} Val={value} Func={function} Proto={protocol}")

        # ✅ RTU over TCP (Raw TCP)
        if protocol == "tcp":
             try:
                print(f"[CONTROL] Using RTU over TCP protocol")
                # Modbus RTU Frame: Slave(1) + Func(1) + Addr(2) + Data(2) + CRC(2)
                payload = struct.pack(">B B H H", slave, function, address, value)
                print(f"[CONTROL] Payload: {payload.hex()}")
                
                # CRC16 Calculation
                crc = 0xFFFF
                for ch in payload:
                    crc ^= ch
                    for _ in range(8):
                        if crc & 1:
                            crc = (crc >> 1) ^ 0xA001
                        else:
                            crc >>= 1
                
                frame = payload + struct.pack("<H", crc) # Little Endian for CRC
                print(f"[CONTROL] Frame with CRC: {frame.hex()}")

                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(5)  # Increase timeout to 5 seconds
                print(f"[CONTROL] Connecting to {ip}:{port}...")
                s.connect((ip, port))
                print(f"[CONTROL] Connected, sending {len(frame)} bytes...")
                s.send(frame)
                print(f"[CONTROL] Waiting for response...")
                resp = s.recv(1024)
                s.close()
                print(f"[CONTROL] Received {len(resp)} bytes: {resp.hex()}")

                if len(resp) >= 5:
                    # Check response: Slave, Func match (CRC check omitted for brevity)
                    r_slave, r_func = struct.unpack(">B B", resp[:2])
                    print(f"[CONTROL] Response slave={r_slave}, func={r_func}")
                    if r_slave == slave and r_func == function:
                        print(f"[CONTROL] ✓ RTU Write SUCCESS")
                        return True
                    else:
                        print(f"[CONTROL] RTU Response Mismatch: expected slave={slave} func={function}, got slave={r_slave} func={r_func}")
                else:
                    print(f"[CONTROL] Response too short: {len(resp)} bytes")
                # Fall through to try ModbusTCP/MBAP fallback
                print(f"[CONTROL] RTU over TCP write did not confirm, trying MBAP fallback...")

             except socket.timeout as e:
                print(f"[CONTROL] RTU over TCP TIMEOUT: {e}")
                # Try MBAP fallback below
             except ConnectionRefusedError as e:
                print(f"[CONTROL] RTU over TCP CONNECTION REFUSED: {e}")
                # Try MBAP fallback below
             except Exception as e:
                print(f"[CONTROL] RTU over TCP Error: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                # Try MBAP fallback below

        # ✅ Modbus TCP (default)
        # Try pymodbus first
        if ModbusTcpClient:
            try:
                client = ModbusTcpClient(ip, port=port, timeout=3)
                if client.connect():
                    if function == 5:
                        # Pymodbus write_coil takes boolean
                        try:
                            rr = client.write_coil(address, value == 0xFF00, slave=slave)
                        except TypeError:
                            rr = client.write_coil(address, value == 0xFF00, unit=slave)
                    elif function == 6:
                        # ✅ Function 6: Write Single Register
                        try:
                            rr = client.write_register(address, value, slave=slave)
                        except TypeError:
                            rr = client.write_register(address, value, unit=slave)
                    else:
                        client.close()
                        return False  # Unsupported function
                    
                    client.close()
                    if not rr.isError():
                        return True
                    else:
                        print(f"[CONTROL] Pymodbus Error: {rr}")
            except Exception as e:
                print(f"[CONTROL] Pymodbus Exception: {e}")

        # Fallback to Raw Socket (Robust implementation)
        try:
            tid = int(time.time() * 1000) & 0xFFFF
            pid = 0
            length = 6
            # Modbus TCP Header: TID(2) + PID(2) + LEN(2) + UID(1) + FUNC(1) + ADDR(2) + DATA(2)
            
            pdu = struct.pack(">B B H H", slave, function, address, value)
            mbap = struct.pack(">H H H", tid, pid, len(pdu))
            req = mbap + pdu
            
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((ip, port))
            s.send(req)
            resp = s.recv(1024)
            s.close()
            
            if len(resp) >= 9:
                # Check response: TID, PID, LEN, UID, FUNC match
                r_tid, r_pid, r_len, r_uid, r_func = struct.unpack(">H H H B B", resp[:8])
                if r_tid == tid and r_func == function:
                    return True
            return False
            
        except Exception as e:
            print(f"[CONTROL] Raw Socket Error: {e}")
            return False

    def execute_control(self, descriptor: ControlDescriptor) -> AuditLogEntry:
        """
        Main Control Logic
        """
        print(f"[CONTROL] Received Request: {descriptor}")
        
        audit_entry = AuditLogEntry(
            **descriptor.dict(),
            status="failed",
            error_message="Unknown Error"
        )

        # 1. Find Device Configuration
        device_config = self._find_device_config(descriptor.device_id)
        if not device_config:
            audit_entry.error_message = "Device not found"
            self._log_audit(audit_entry)
            return audit_entry

        # 2. Determine Modbus Parameters
        ip = device_config.get('modbus_ip')
        port = device_config.get('modbus_port', 502)
        slave = device_config.get('modbus_slave', 1)
        
        # ✅ Get protocol from parent converter, not device
        parent_id = device_config.get('parent')
        protocol = 'modbus_tcp'  # default
        
        if parent_id:
            protocol = self._find_parent_protocol(parent_id)
            print(f"[CONTROL] Parent converter {parent_id} protocol={protocol}")
        
        if 'tcp' in protocol and 'modbus' not in protocol:
            protocol = 'tcp' # Normalize to 'tcp' for RTU over TCP
            print(f"[CONTROL] Using RTU over TCP mode")

        if not ip:
            audit_entry.error_message = "Device IP configuration missing"
            self._log_audit(audit_entry)
            return audit_entry

        # 3. Resolve Control Target to Modbus Address
        # Support for CVM-C11 Digital Outputs and generic control targets
        
        address = 0
        value = 0
        function = 5 # Default Coil (Function Code 5 for digital outputs)
        
        # --- CONTROL ABSTRACTION LOGIC ---
        # CVM-C11 Digital Output Mapping (from device template)
        # Digital Output 1: Address 17, Function 1 (Read Coils) / Function 5 (Write Single Coil)
        # Digital Output 2: Address 18, Function 1 (Read Coils) / Function 5 (Write Single Coil)
        # Alarm Relay 1: Address 15
        # Alarm Relay 2: Address 16
        
        control_target_map = {
            "digital_output_1": 17,
            "digital_output_2": 18,
            "alarm_relay_1": 15,
            "alarm_relay_2": 16,
            "relay_1": 0,  # Legacy support
            "breaker_main": 10  # Legacy support
        }
        
        # Resolve target to address
        target_lower = descriptor.control_target.lower()
        write_inverted = False
        if target_lower in control_target_map:
            address = control_target_map[target_lower]
            # Lookup write inversion from device template
            try:
                outputs_info = device_discovery_service.get_device_outputs(str(descriptor.device_id))
                for out in outputs_info.get('outputs', []):
                    if (out.get('control_target') == target_lower) or (int(out.get('address', -1)) == int(address)):
                        write_inverted = bool(out.get('write_inverted'))
                        break
            except Exception:
                write_inverted = False
            if descriptor.action == "TOGGLE":
                current_state = self._read_coil_status(ip, int(port), int(slave), address, protocol=protocol)
                if current_state is None:
                    audit_entry.error_message = "Failed to read current state for toggle"
                    self._log_audit(audit_entry)
                    return audit_entry
                value = 0x0000 if current_state == 1 else 0xFF00
                function = 5
            else:
                act = (descriptor.action or "").upper()
                if act in ("ON", "1"):
                    value = 0x0000 if write_inverted else 0xFF00
                else:
                    value = 0xFF00 if write_inverted else 0x0000
                function = 5
        elif descriptor.control_target.isdigit():
            # Direct address specification (e.g., "17", "18")
            address = int(descriptor.control_target)
            # Try lookup by address
            try:
                outputs_info = device_discovery_service.get_device_outputs(str(descriptor.device_id))
                for out in outputs_info.get('outputs', []):
                    if int(out.get('address', -1)) == int(address):
                        write_inverted = bool(out.get('write_inverted'))
                        break
            except Exception:
                write_inverted = False
            if descriptor.action == "TOGGLE":
                current_state = self._read_coil_status(ip, int(port), int(slave), address, protocol=protocol)
                if current_state is None:
                    audit_entry.error_message = "Failed to read current state for toggle"
                    self._log_audit(audit_entry)
                    return audit_entry
                value = 0x0000 if current_state == 1 else 0xFF00
                function = 5
            else:
                act = (descriptor.action or "").upper()
                if act in ("ON", "1"):
                    value = 0x0000 if write_inverted else 0xFF00
                else:
                    value = 0xFF00 if write_inverted else 0x0000
                function = 5
        else:
            audit_entry.error_message = f"Unknown control target: {descriptor.control_target}"
            self._log_audit(audit_entry)
            return audit_entry
        
        print(f"[CONTROL] Resolved Target '{descriptor.control_target}' -> Address {address}, Value {hex(value)}, Function {function}")
        act = (descriptor.action or "").upper()
        print(f"[CONTROL] Final Action: {act}, Address: {address}, Value: {hex(value)}")
        success = self._write_modbus(ip, int(port), int(slave), address, value, function, protocol=protocol)

        if success:
            audit_entry.status = "success"
            audit_entry.error_message = None
            
            # ✅ Read back status to verify
            time.sleep(0.2)  # Small delay for device to process
            try:
                current_state = self._read_coil_status(ip, int(port), int(slave), address, protocol=protocol)
                if current_state is not None:
                    if act == "TOGGLE":
                        expected_state = 1 if value == 0xFF00 else 0
                    elif act in ("ON", "1"):
                        expected_state = 0 if write_inverted else 1
                    else:
                        expected_state = 1 if write_inverted else 0
                    
                    if current_state == expected_state:
                        audit_entry.error_message = f"Verified: Output is {act}"
                    else:
                        audit_entry.error_message = f"Warning: Expected {expected_state}, got {current_state}"
            except Exception as e:
                print(f"[CONTROL] Status read-back failed: {e}")
        else:
            # ❌ Hardware unreachable - Use virtual device
            if virtual_device:
                print(f"[CONTROL] Hardware unreachable. Using VIRTUAL DEVICE for {descriptor.device_id}")
                
                # Write to virtual device
                virtual_value = 1 if descriptor.action == "ON" else 0
                virtual_success = virtual_device.write_coil(descriptor.device_id, address, virtual_value)
                
                if virtual_success:
                    audit_entry.status = "success"
                    audit_entry.error_message = f"Virtual Device: Output is {descriptor.action} (Hardware offline)"
                    print(f"[CONTROL] ✓ Virtual write successful: Device {descriptor.device_id} Address {address} = {virtual_value}")
                else:
                    audit_entry.status = "failed"
                    audit_entry.error_message = "Virtual device write failed"
            else:
                # No virtual device available
                audit_entry.status = "failed"
                audit_entry.error_message = f"Modbus write failed - device unreachable at {ip}:{port}"
                print(f"[CONTROL] ❌ Hardware write failed for {descriptor.device_id} at {ip}:{port}")

        self._log_audit(audit_entry)
        return audit_entry
    
    def _read_coil_status_with_fallback(self, device_id: str, ip: str, port: int, slave: int, address: int, protocol: str = "modbus_tcp") -> Optional[int]:
        """
        Wrapper for _read_coil_status, compatible with router.py call signature (includes device_id)
        """
        return self._read_coil_status(ip, port, slave, address, protocol=protocol)

    def _read_coil_status(self, ip: str, port: int, slave: int, address: int, protocol: str = "modbus_tcp") -> Optional[int]:
        """
        Read current coil status (Function Code 1: Read Coils) with Retry
        Returns 1 for ON, 0 for OFF, None on error
        """
        for attempt in range(1, 3): # Reduced retries to 2
            try:
                # 1. Try Pymodbus TCP
                if protocol == "modbus_tcp" and ModbusTcpClient:
                    client = ModbusTcpClient(ip, port=port, timeout=1.5) # Reduced timeout
                    if client.connect():
                        try:
                            rr = client.read_coils(address, 1, slave=slave)
                        except TypeError:
                            rr = client.read_coils(address, 1, unit=slave)
                        
                        client.close()
                        if not rr.isError() and rr.bits:
                            return 1 if rr.bits[0] else 0

                # 2. Raw Socket / RTU Fallback
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.8) # Reduced timeout
                try:
                    s.connect((ip, port))
                    
                    if protocol == "tcp":
                         # RTU over TCP Frame
                         payload = struct.pack(">B B H H", slave, 1, address, 1)
                         crc = 0xFFFF
                         for ch in payload:
                             crc ^= ch
                             for _ in range(8):
                                 if crc & 1: crc = (crc >> 1) ^ 0xA001
                                 else: crc >>= 1
                         frame = payload + struct.pack("<H", crc)
                         s.send(frame)
                         resp = s.recv(1024)
                         if len(resp) >= 4:
                             r_slave, r_func, byte_count = struct.unpack(">B B B", resp[:3])
                             if r_slave == slave and r_func == 1:
                                 return 1 if (resp[3] & 1) else 0

                    else:
                        # Raw Modbus TCP Packet
                        # TID(2), PID(2), LEN(2), UID(1), FUNC(1), START(2), CNT(2)
                        # Func 1: Read Coils
                        req = struct.pack(">H H H B B H H", 
                                          0x0001, 0x0000, 0x0006, 
                                          slave, 0x01, address, 0x0001)
                        s.send(req)
                        head = s.recv(9) # Header up to ByteCount?
                        # MBAP(7) + Func(1) + Len(1) = 9
                        if len(head) == 9:
                             # Read data byte
                             data = s.recv(1)
                             if len(data) == 1:
                                 return 1 if (data[0] & 1) else 0
                        else:
                             # Try reading all
                             more = s.recv(1024)
                             full = head + more
                             if len(full) >= 10:
                                 return 1 if (full[9] & 1) else 0

                finally:
                    s.close()

            except Exception as e:
                print(f"[CONTROL] Read retry {attempt}/2 failed: {e}")
                time.sleep(0.1)
        
        return None

    
    def _read_coil_status_with_fallback(self, device_id: str, ip: str, port: int, slave: int, address: int, protocol: str = "modbus_tcp") -> Optional[int]:
        """
        Read coil status with virtual device fallback
        """
        # Try hardware first
        status = self._read_coil_status(ip, port, slave, address, protocol)
        
        # If hardware fails, try virtual device
        if status is None and virtual_device:
            status = virtual_device.read_coil(device_id, address)
            if status is not None:
                print(f"[CONTROL] Using virtual device status for Device {device_id} Address {address}: {status}")
        
        return status

    def _write_modbus(self, ip: str, port: int, slave: int, address: int, value: int, function: int = 5, protocol: str = "modbus_tcp") -> bool:
        """
        Execute Modbus Write Command with Retry Mechanism (2 Attempts)
        """
        for attempt in range(1, 3): # Reduced retries
            try:
                print(f"[CONTROL] Write Attempt {attempt}/2: {ip}:{port} Slave={slave} Addr={address} Val={hex(value)} Func={function} Proto={protocol}")

                # 1. RTU over TCP (Raw Socket)
                if protocol == "tcp":
                    try:
                        # Modbus RTU Frame: Slave(1) + Func(1) + Addr(2) + Data(2) + CRC(2)
                        payload = struct.pack(">B B H H", slave, function, address, value)
                        
                        # CRC16
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1: crc = (crc >> 1) ^ 0xA001
                                else: crc >>= 1
                        
                        frame = payload + struct.pack("<H", crc)
                        
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(1.5) # Reduced timeout
                        s.connect((ip, port))
                        s.send(frame)
                        resp = s.recv(1024)
                        s.close()
                        
                        if len(resp) >= 5:
                            r_slave, r_func = struct.unpack(">B B", resp[:2])
                            if r_slave == slave and r_func == function:
                                print(f"[CONTROL] ✓ RTU Write SUCCESS")
                                return True
                    except Exception as e:
                        print(f"[CONTROL] RTU Write Error: {e}")

                # 2. STANDARD MODBUS TCP (Pymodbus)
                if ModbusTcpClient and protocol == "modbus_tcp":
                    try:
                        client = ModbusTcpClient(ip, port=port, timeout=1.5) # Reduced timeout
                        if client.connect():
                            rr = None
                            if function == 5:
                                # Pymodbus write_coil takes boolean
                                try:
                                    rr = client.write_coil(address, value == 0xFF00, slave=slave)
                                except TypeError:
                                    rr = client.write_coil(address, value == 0xFF00, unit=slave)
                            elif function == 6:
                                rr = client.write_register(address, value, slave=slave)
                            
                            client.close()
                            
                            if rr and not rr.isError():
                                print(f"[CONTROL] ✓ Pymodbus Write SUCCESS")
                                return True
                    except Exception as e:
                        print(f"[CONTROL] Pymodbus Write Error: {e}")

                # 3. FALLBACK: RAW MODBUS TCP (MBAP)
                try:
                    tid = int(time.time() * 1000) & 0xFFFF
                    pdu = struct.pack(">B B H H", slave, function, address, value)
                    mbap = struct.pack(">H H H", tid, 0, len(pdu))
                    req = mbap + pdu
                    
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(1.5) # Reduced timeout
                    s.connect((ip, port))
                    s.send(req)
                    resp = s.recv(1024)
                    s.close()
                    
                    if len(resp) >= 9:
                         r_tid, r_pid, r_len, r_uid, r_func = struct.unpack(">H H H B B", resp[:8])
                         if r_tid == tid and r_func == function:
                             print(f"[CONTROL] ✓ MBAP Write SUCCESS")
                             return True
                except Exception as e:
                    print(f"[CONTROL] Raw Socket Write Error: {e}")

            except Exception as e:
                print(f"[CONTROL] Global Write Error: {e}")
            
            time.sleep(0.1) # Reduced sleep

        print(f"[CONTROL] ❌ All 2 write attempts failed.")
        return False

control_service = ControlService()
