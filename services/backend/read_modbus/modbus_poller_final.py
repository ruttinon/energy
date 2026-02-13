#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
✅ Realtime Modbus Poller (JSON Local Version)
--------------------------------------------------
- ใช้ convertors.json แทน Firebase
- อ่านค่า Modbus หลายอุปกรณ์พร้อมกัน (thread-per-device)
- เขียนข้อมูลลง readings.json + SQLite log
- Auto reload เมื่อ convertors.json เปลี่ยน
"""
# ✅ รองรับได้ทั้ง pymodbus 2.x และ 3.x+
try:
    from pymodbus.client.sync import ModbusTcpClient
except ImportError:
    try:
        from pymodbus.client import ModbusTcpClient
    except Exception:
        ModbusTcpClient = None

try:
    import pymodbus
    print(f"📦 Pymodbus Version: {pymodbus.__version__}")
except Exception:
    print("📦 Pymodbus Version: Unknown")
import socket
from datetime import datetime
import time, json, os, sqlite3, ctypes, threading, sys, traceback, struct
import shutil

import socket
from datetime import datetime
import time, json, os, sqlite3, ctypes, threading, sys, traceback, struct
flatten_devices = None
load_readings = None
save_readings = None

# ✅ Try to import shared_state from main application
try:
    from services.backend import shared_state
except ImportError:
    shared_state = None

# ===========================================================
# ✅ Add missing config_path (support all build environments)
# ===========================================================
try:
    base_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
except Exception:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


# ✅ path ใหม่ทั้งหมดอยู่ในโฟลเดอร์หลัก /data
sys.path.append(base_dir)

# ✅ Import DatabaseManager
DatabaseManager = None
try:
    try:
        from api.database import DatabaseManager
    except ImportError:
        from services.backend.database import DatabaseManager
except ImportError as e:
    DatabaseManager = None
    # Silent fail - DatabaseManager is optional
    pass

# Remove xlsx_storage imports
save_readings_batch = None
get_project_db_path = None

DATA_DIR = os.path.join(base_dir, "data")
os.makedirs(DATA_DIR, exist_ok=True)
logs_dir = os.path.join(base_dir, "logs")
try:
    os.makedirs(logs_dir, exist_ok=True)
except Exception:
    pass
LOG_FILE = os.path.join(logs_dir, "modbus_poller.log")

def write_log(msg):
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass

def _is_valid_ip(ip):
    try:
        s = str(ip or '').strip()
        if not s:
            return False
        if s in {"1.2.3.5", "0.0.0.0"}:
            return False
        parts = s.split('.')
        if len(parts) != 4:
            return False
        for p in parts:
            if not p.isdigit():
                return False
            n = int(p)
            if n < 0 or n > 255:
                return False
        return True
    except Exception:
        return False
def _projects_root():
    if getattr(sys, "frozen", False):
        return os.path.join(base_dir, 'projects')
    return os.path.abspath(os.path.join(base_dir, '..', '..', 'projects'))

def _active_project_id():
    try:
        if shared_state:
            info = shared_state.load_active()
            return (info or {}).get('active')
    except Exception:
        pass
    try:
        p = os.path.join(base_dir, 'active_project.json')
        d = json.load(open(p, 'r', encoding='utf-8'))
        return d.get('active')
    except Exception:
        return None

def _project_config_path(pid):
    return os.path.join(_projects_root(), pid or '', 'ConfigDevice.json')

def _normalize_protocol(p):
    s = (p or '').lower()
    if 'modbus' in s:
        return 'modbus_tcp'
    if s == 'tcp':
        return 'tcp'
    if 'udp' in s:
        return 'udp'
    if s == 'tcp_server':
        return 'tcp'
    if 'teu' in s:
        return 'tcp'
    return 'modbus_tcp'

def flatten_devices():
    try:
        pid = _active_project_id()
        cfgp = _project_config_path(pid)
        data = json.load(open(cfgp, 'r', encoding='utf-8'))
        out = {}
        for conv in (data.get('converters') or []):
            for dev in (conv.get('devices') or []):
                did = str(dev.get('id'))
                host = (conv.get('settings') or {}).get('host') or conv.get('address')
                ip_raw = dev.get('modbus_ip')
                ip_use = ip_raw if _is_valid_ip(ip_raw) else host
                out[did] = {
                    'modbus_ip': ip_use,
                    'modbus_port': int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502),
                    'modbus_slave': int(dev.get('modbus_slave') or dev.get('address') or 1),
                    'polling_interval': int(dev.get('polling_interval') or 3),
                    'protocol': _normalize_protocol(dev.get('protocol') or conv.get('protocol') or 'modbus_tcp'),
                    'convertor_id': conv.get('id'),
                    'name': dev.get('name', did),
                    'template': dev.get('template'),
                    'registers': (dev.get('registers') or [])
                }
        return out
    except Exception:
        return {}

def load_readings():
    return READINGS_MEM

def save_readings(d):
    READINGS_MEM.update(d)
    if shared_state and isinstance(d, dict):
        for did, raw in d.items():
            _push_shared(str(did), None, raw)

def _to_shared_record(dev_id, cfg, raw):
















    
    values = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k in ("timestamp", "device_id", "online"):
                continue
            if v is None:
                continue
            values[k] = v
    name = None
    if isinstance(cfg, dict):
        name = cfg.get("name")
    ts = raw.get("timestamp") if isinstance(raw, dict) else None
    # ✅ FIX: Default to False (Offline) if status is unknown/missing
    online = bool(raw.get("online")) if isinstance(raw, dict) and "online" in raw else False
    return {
        "device_id": str(dev_id),
        "device_name": name or str(dev_id),
        "timestamp": ts,
        "online": online,
        "values": values,
    }

def _push_shared(dev_id, cfg, raw):
    if not shared_state:
        return
    pid = _active_project_id()
    if not pid:
        return
    rec = _to_shared_record(dev_id, cfg, raw)
    try:
        with shared_state.READINGS_LOCK:
            shared_state.READINGS.setdefault(pid, {})
            shared_state.READINGS[pid][str(dev_id)] = rec
    except Exception:
        pass

def read_modbus_tcp_raw(ip, port, unit_id, function, address, count, timeout=1.0):
    try:
        tid = int(time.time() * 1000) & 0xFFFF
        pid = 0
        length = 6
        pdu = struct.pack(">B B H H", unit_id, function, address, count)
        mbap = struct.pack(">H H H", tid, pid, length)
        req = mbap + pdu
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.send(req)
        data = s.recv(1024)
        s.close()
        if len(data) < 9:
            return None
        uid, func, byte_count = struct.unpack(">B B B", data[6:9])
        if func != function:
            return None
        
        # ✅ Handle Coils/Discrete Inputs (Func 1/2)
        if func in [1, 2]:
             # Return just the first bit for now as a single "register" value
             val = 1 if (data[9] & 1) else 0
             return [val]

        regs = []
        for i in range(0, byte_count, 2):
            regs.append((data[9 + i] << 8) + data[10 + i])
        return regs
    except Exception:
        return None

def read_modbus_udp_raw(ip, port, unit_id, function, address, count, timeout=1.0):
    try:
        tid = int(time.time() * 1000) & 0xFFFF
        pid = 0
        length = 6
        pdu = struct.pack(">B B H H", unit_id, function, address, count)
        mbap = struct.pack(">H H H", tid, pid, length)
        req = mbap + pdu
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(timeout)
        s.sendto(req, (ip, port))
        data, _ = s.recvfrom(1024)
        s.close()
        if len(data) < 9:
            return None
        uid, func, byte_count = struct.unpack(">B B B", data[6:9])
        if func != function:
            return None
        if func in [1, 2]:
            val = 1 if (data[9] & 1) else 0
            return [val]
        regs = []
        for i in range(0, byte_count, 2):
            regs.append((data[9 + i] << 8) + data[10 + i])
        return regs
    except Exception:
        return None

# ✅ กำหนดไฟล์หลักที่ใช้ในระบบ
CONFIG_FILE = os.path.join(DATA_DIR, "convertors.json")
READINGS_FILE = os.path.join(DATA_DIR, "readings.json")
REALTIME_FILE = os.path.join(DATA_DIR, "realtime_data.json")
READINGS_MEM = {}

# ============================================================
# 💾 ฟังก์ชันเขียนข้อมูลลง SQLite (Project Specific)
# ============================================================
def _write_log_sqlite(project_id, reading_data: dict, dev_name_map: dict):
    if not get_project_db_path: # Check if import succeeded
        return

    try:
        from sqlalchemy import text
        engine = get_project_engine(project_id)
        
        # Ensure table exists
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    device_id TEXT,
                    device_name TEXT,
                    key TEXT,
                    value REAL,
                    unit TEXT
                )
            """))
            conn.commit()
            
            # Prepare Data
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            values = []
            
            for did, data in reading_data.items():
                dname = dev_name_map.get(did, did)
                if isinstance(data, dict):
                    for k, v in data.items():
                        # Save numeric values only
                        try:
                            val_float = float(v)
                            # Basic validation to avoid saving crazily large numbers or NaNs
                            if val_float == float('inf') or val_float == float('-inf'): 
                                continue
                                
                            values.append({
                                "timestamp": timestamp,
                                "device_id": str(did),
                                "device_name": dname,
                                "key": str(k),
                                "value": val_float,
                                "unit": "" 
                            })
                        except:
                            pass
            
            if values:
                # Use bulk insert logic if possible, or simple loop with param binding
                # SQLAlchemy Core 1.4+ style
                conn.execute(text("""
                    INSERT INTO readings (timestamp, device_id, device_name, key, value, unit)
                    VALUES (:timestamp, :device_id, :device_name, :key, :value, :unit)
                """), values)
                conn.commit()
                # print(f"✅ Logged {len(values)} rows to SQLite for {project_id}")

    except Exception as e:
        print(f"⚠️ SQLite Log Error: {e}")


# ============================================================
# 📄 ตรวจสอบว่ามี convertors.json แล้วหรือยัง
# ============================================================
if not os.path.exists(CONFIG_FILE):
    src_base = getattr(sys, "_MEIPASS", None)
    if src_base:
        src_data = os.path.join(src_base, "data")
        try:
            if os.path.isdir(src_data):
                for name in os.listdir(src_data):
                    s = os.path.join(src_data, name)
                    d = os.path.join(DATA_DIR, name)
                    if os.path.isdir(s):
                        os.makedirs(d, exist_ok=True)
                        for r, _, files in os.walk(s):
                            rel = os.path.relpath(r, s)
                            dst_dir = os.path.join(d, rel) if rel != "." else d
                            os.makedirs(dst_dir, exist_ok=True)
                            for f in files:
                                shutil.copy2(os.path.join(r, f), os.path.join(dst_dir, f))
                    else:
                        shutil.copy2(s, d)
        except Exception:
            pass


# ============================================================
# 🧭 ฟังก์ชันหาโฟลเดอร์หลัก (รองรับ .exe)
# ============================================================
def get_base_dir():
    """
    ✅ คืน path โฟลเดอร์หลักของระบบ
    - ถ้ารันจาก .exe → จะชี้ไปยังโฟลเดอร์เดียวกับไฟล์ .exe
    - ถ้ารันจาก Python ปกติ → จะชี้ไปยังโฟลเดอร์โปรเจกต์
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ถ้ามีไฟล์เก่าอยู่ให้ลบทิ้ง
os.makedirs(DATA_DIR, exist_ok=True)

def append_realtime():
    """เพิ่มค่าใหม่พร้อม timestamp ทุก 10 นาที (Historical Log)"""
    while True:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            active_project = _active_project_id()
             
            if active_project and DatabaseManager:
                # 1. Prepare Data
                readings = load_readings() # {dev_id: {key: val}}
                dev_configs = flatten_devices() if active_project else {}
                
                batch_list = []
                for device_id, values in readings.items():
                    dev_cfg = dev_configs.get(device_id, {})
                    dname = dev_cfg.get('name', device_id)
                    regs = dev_cfg.get('registers', [])
                    # Create Map for Units
                    reg_map = {r['key']: r.get('unit', '') for r in regs}
                    
                    for k, v in values.items():
                        batch_list.append({
                            'device_id': device_id,
                            'device_name': dname,
                            'parameter': k, # Consistent naming
                            'value': v,
                            'unit': reg_map.get(k, '')
                        })

                # 2. Log to SQL (Historical)
                if batch_list:
                    projects_root = _projects_root()
                    db = DatabaseManager(active_project, projects_root)
                    db.log_historical(batch_list)
                    print(f"🕒 Historical data logged at {timestamp} for {active_project}")

        except Exception as e:
            print("🔥 Historical Logger Error:", e)

        time.sleep(600)  # ✅ เก็บทุก 10 นาที (User Request)

# ===========================================================
# ✅ Path handler
# ===========================================================
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# ===========================================================
# ✅ Local Database (SQLite)
# ===========================================================
LOCAL_DB = os.path.join(base_dir, "modbus_data", "modbus_log.db")
os.makedirs(os.path.join(base_dir, "modbus_data"), exist_ok=True)

conn = sqlite3.connect(LOCAL_DB, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    timestamp TEXT,
    data_json TEXT
)
""")
conn.commit()


def save_local(device_id, data):
    """บันทึกข้อมูลลง SQLite เพื่อสำรอง"""
    try:
        cursor.execute(
            "INSERT INTO readings (device_id, timestamp, data_json) VALUES (?, ?, ?)",
            (device_id, datetime.now().isoformat(), json.dumps(data))
        )
        conn.commit()
    except Exception as e:
        print(f"⚠️ Local save failed: {e}")


# ===========================================================
# ✅ Modbus Read Function (backwards-compatible)
# ===========================================================
def read_register(client, slave_id, address, scale):
    """อ่านค่า Holding Register แบบ 32-bit signed (เดิม)"""
    try:
        try:
            rr = client.read_holding_registers(address, 2, slave=slave_id)
        except TypeError:
            rr = client.read_holding_registers(address, 2, unit=slave_id)
            
        if rr.isError():
            return None
        reg0, reg1 = rr.registers
        raw = (reg0 << 16) | (reg1 & 0xFFFF)
        val = ctypes.c_int32(raw).value / (scale or 1)
        return val
    except Exception as e:
        print(f"❌ Error read addr {address} (slave {slave_id}): {e}")
        return None

# ===========================================================
# ✅ Universal Register Reader (แบบเดียวกับ modbus_reader.py)
# ===========================================================
# ===========================================================
# ✅ Universal Modbus Reader (รองรับ float32_ABCD/DCBA/BADC/CDAB)
# ===========================================================
# ===========================================================
# ✅ Unified Buffer Decoder (All Types)
# ===========================================================
def decode_buffer(data_bytes, datatype, scale):
    try:
        if not data_bytes:
            return None
        
        dtype = (datatype or "int16").lower()
        val = None
        
        # --- Float 32 ---
        if "float32" in dtype:
            if len(data_bytes) < 4: return None
            # Standard Big Endian (ABCD)
            val_abcd = struct.unpack(">f", data_bytes[:4])[0]
            
            if "_dcba" in dtype or dtype.endswith("_le"):
                # Little Endian (DCBA)
                val = struct.unpack("<f", data_bytes[:4])[0]
            elif "_badc" in dtype:
                # Byte Swap (BADC)
                val = struct.unpack(">f", data_bytes[2:4] + data_bytes[0:2])[0]
            elif "_cdab" in dtype:
                # Word Swap (CDAB)
                val = struct.unpack("<f", data_bytes[2:4] + data_bytes[0:2])[0] # equiv to little endian of word swapped? No.
                # CDAB is little endian of big endian words? 
                # Let's map explicitly:
                # ABCD = b0 b1 b2 b3
                # CDAB = b2 b3 b0 b1
                tmp = data_bytes[2:4] + data_bytes[0:2]
                val = struct.unpack(">f", tmp)[0]
            elif "_abcd" in dtype or dtype.endswith("_be"):
                 val = val_abcd
            else:
                 val = val_abcd # Default

        # --- Float 64 (Double) ---
        elif "float64" in dtype or "double" in dtype:
            if len(data_bytes) < 8: return None
            val = struct.unpack(">d", data_bytes[:8])[0]
            if "le" in dtype or "little" in dtype:
                val = struct.unpack("<d", data_bytes[:8])[0]

        # --- Int/Uint 32 ---
        elif "int32" in dtype:
            if len(data_bytes) < 4: return None
            fmt = ">i" if "big" in dtype or "be" in dtype else ">i" # Default Big
            if "little" in dtype or "le" in dtype or "swap" in dtype: fmt = "<i"
            if "uint32" in dtype: fmt = fmt.replace("i", "I")
            
            val = struct.unpack(fmt, data_bytes[:4])[0]
            
            # Special manual case for old "swap" naming if needed, but struct handles it.

        # --- Int/Uint 64 ---
        elif "int64" in dtype:
            if len(data_bytes) < 8: return None
            fmt = ">q"
            if "little" in dtype or "le" in dtype: fmt = "<q"
            if "uint64" in dtype: fmt = fmt.replace("q", "Q")
            val = struct.unpack(fmt, data_bytes[:8])[0]

        # --- Int/Uint 16 ---
        elif "int16" in dtype:
            if len(data_bytes) < 2: return None
            # Default Big Endian for Modbus
            val = struct.unpack(">h", data_bytes[:2])[0]
            if "uint16" in dtype:
                val = struct.unpack(">H", data_bytes[:2])[0]
            
            # Little endian support
            if "le" in dtype or "little" in dtype:
                 val = struct.unpack("<h", data_bytes[:2])[0]
                 if "uint16" in dtype: val = struct.unpack("<H", data_bytes[:2])[0]

        else:
            # Fallback: Treat as 16-bit register (first word)
            if len(data_bytes) >= 2:
                val = struct.unpack(">h", data_bytes[:2])[0]
        
        if val is not None:
             return round(val / float(scale or 1), 6)
        return None
    except Exception as e:
        # print(f"Decode error: {e}")
        return None

# ===========================================================
# ✅ Universal Modbus Reader (Refactored)
# ===========================================================
def read_modbus_value(client, slave_id, address, datatype="int16", scale=1, function=3, words=2):
    try:
        def _try_read(method_name, addr, cnt, sid):
            method = getattr(client, method_name)
            # 1. Try 'slave' (Pymodbus v3.x+)
            try:
                return method(addr, cnt, slave=sid)
            except TypeError:
                pass # Fallthrough

            # 2. Try 'unit' (Pymodbus v2.x)
            try:
                return method(addr, cnt, unit=sid)
            except TypeError:
                pass # Fallthrough

            # 3. Try legacy device_id (some custom wrappers)
            try:
                return method(addr, cnt, device_id=sid)
            except TypeError:
                pass
            
            # If all fail, try one last time with 'slave' to raise the actual error for v3, 
            # or just raise a generic error to avoid 'unexpected keyword unit' confusion
            return method(addr, cnt, slave=sid) 

        rr = None
        if function == 3: rr = _try_read('read_holding_registers', address, words, slave_id)
        elif function == 4: rr = _try_read('read_input_registers', address, words, slave_id)
        elif function == 1: rr = _try_read('read_coils', address, words, slave_id)
        elif function == 2: rr = _try_read('read_discrete_inputs', address, words, slave_id)
        
        if not rr or rr.isError(): 
            # print(f"⚠️ Read Error: {rr}")
            return None

        # Coils/Discrete
        if function in [1, 2]:
             return 1 if (rr.bits and rr.bits[0]) else 0

        regs = rr.registers
        if not regs: return None

        # Pack to bytes -> Decode
        data_bytes = b"".join(int(x).to_bytes(2, "big") for x in regs)
        return decode_buffer(data_bytes, datatype, scale)

    except Exception as e:
        # Avoid spamming logs for timeouts, but print critical errors
        # print(f"❌ Error reading {datatype} at addr {address}: {e}")
        return None


    except Exception as e:
        print(f"❌ Error reading {datatype} at addr {address}: {e}")
        return None


# ===========================================================
# ✅ Robust TCP Receiver
# ===========================================================
def recv_strict(sock, count):
    """
    อ่านข้อมูลจาก socket ให้ครบตามจำนวน byte ที่ระบุ
    ป้องกันปัญหา TCP Fragmentation (อ่านไม่ครบ)
    """
    buf = b''
    while len(buf) < count:
        try:
            more = sock.recv(count - len(buf))
            if not more:
                return None
            buf += more
        except socket.timeout:
            return None
        except Exception:
            return None
    return buf

# ===========================================================
# ✅ Polling Thread (รองรับ modbus_tcp + tcp)
# ===========================================================
def poll_device(dev_id, cfg):
    ip = cfg.get("modbus_ip")
    port = cfg.get("modbus_port", 502)
    slave = cfg.get("modbus_slave", 1)
    interval = cfg.get("polling_interval", 1) # Faster default
    protocol = (cfg.get("protocol") or "modbus_tcp").lower()
    convertor_id = cfg.get("convertor_id", "unknown")

    offline_count = 0
    online_status = False

    print(f"📡 Start polling {dev_id} ({protocol}) {ip}:{port}, slave={slave}")
    write_log(f"Start polling {dev_id} {ip}:{port} slave={slave} protocol={protocol}")

    while not stop_flags.get(dev_id, False):
        try:
            start_time = time.time()
            # ✅ FIX: Hold previous values (User Request: "Keep unchanged value")
            data = READINGS_MEM.get(dev_id, {}).copy()
            read_success = False

            if protocol == "modbus_tcp":
                sock = None
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(5.0)
                    sock.connect((ip, port))
                except Exception as e:
                    sock = None

                for reg in cfg.get("registers", []):
                    key = reg["key"]
                    addr = reg["address"]
                    func = reg.get("function", 3)
                    words = reg.get("words", 2)
                    datatype = reg.get("datatype", "int16")
                    scale = reg.get("scale", 1)

                    if not sock:
                        try:
                            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            sock.settimeout(5.0)
                            sock.connect((ip, port))
                        except:
                            sock = None
                            continue

                    try:
                        tid = int(time.time() * 1000) & 0xFFFF
                        pid = 0
                        length = 6
                        pdu = struct.pack(">B B H H", slave, func, addr, words)
                        mbap = struct.pack(">H H H", tid, pid, length)
                        req = mbap + pdu
                        
                        sock.send(req)
                        
                        header = recv_strict(sock, 7)
                        if not header:
                            sock.close()
                            sock = None
                            continue
                            
                        rx_tid, rx_pid, rx_len, rx_uid = struct.unpack(">H H H B", header)
                        
                        body_len = rx_len - 1
                        body = recv_strict(sock, body_len)
                        if not body:
                            sock.close()
                            sock = None
                            continue
                            
                        rx_func = body[0]
                        
                        if rx_func >= 0x80:
                            continue
                            
                        data_bytes = None
                        val = None
                        
                        if func in [1, 2]:
                            byte_count = body[1]
                            if len(body) >= 2 + byte_count:
                                val = 1 if (body[2] & 1) else 0
                        else:
                            byte_count = body[1]
                            if len(body) >= 2 + byte_count:
                                data_bytes = body[2:2+byte_count]
                                val = decode_buffer(data_bytes, datatype, scale)

                        if val is None and func == 3:
                            # 🔄 Fallback: Try Function 4 (Input Register)
                            try:
                                tid = int(time.time() * 1000) & 0xFFFF
                                pid = 0
                                length = 6
                                pdu = struct.pack(">B B H H", slave, 4, addr, words)
                                mbap = struct.pack(">H H H", tid, pid, length)
                                req = mbap + pdu
                                sock.send(req)
                                header = recv_strict(sock, 7)
                                if header:
                                    rx_tid, rx_pid, rx_len, rx_uid = struct.unpack(">H H H B", header)
                                    body_len = rx_len - 1
                                    body = recv_strict(sock, body_len)
                                    if body and body[0] < 0x80:
                                        byte_count = body[1]
                                        if len(body) >= 2 + byte_count:
                                            data_bytes_fb = body[2:2+byte_count]
                                            val = decode_buffer(data_bytes_fb, datatype, scale)
                                            if val is not None:
                                                # ✅ Fallback Success: Update data and flag
                                                data[key] = val
                                                read_success = True
                                                # print(f"✅ Fallback Func 4 Success for {key}")
                            except Exception:
                                pass
                        
                        if val is not None:
                            data[key] = val
                            read_success = True
                        else:
                            print(f"⚠️ Failed to read '{key}' (addr {addr}) from {dev_id}")
                            write_log(f"Failed to read {key} from {dev_id}")
                            
                    except Exception as e:
                        print(f"⚠️ Exception reading '{key}' from {dev_id}: {e}")
                        if sock:
                            sock.close()
                        sock = None
                        # ✅ Stability Sleep: Give device a moment to reset TCP stack
                        time.sleep(0.5)

                if sock:
                    sock.close()

            # ✅ โหมด UDP (Modbus UDP)
            elif protocol == "udp":
                for reg in cfg.get("registers", []):
                    key = reg["key"]
                    addr = reg["address"]
                    func = reg.get("function", 3)
                    words = reg.get("words", 2)
                    datatype = reg.get("datatype", "int16")
                    scale = reg.get("scale", 1)
                    regs = read_modbus_udp_raw(ip, port, slave, func, addr, words)
                    val = None
                    if regs:
                        if func in [1, 2]:
                            val = int(regs[0])
                        else:
                            data_bytes = b"".join(int(x).to_bytes(2, "big") for x in regs)
                            val = decode_buffer(data_bytes, datatype, scale)
                    data[key] = val
                    if val is not None:
                        read_success = True

            # ✅ โหมด TCP (RTU over TCP)
            elif protocol == "tcp":
                sock = None
                # We try to maintain one connection, but reconnect if needed
                
                for reg in cfg.get("registers", []):
                    key = reg["key"]
                    addr = reg["address"]
                    func = reg.get("function", 3)
                    words = reg.get("words", 2)
                    datatype = reg.get("datatype", "int16")
                    scale = reg.get("scale", 1)

                    # 1. Ensure Connection
                    if sock is None:
                        try:
                            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            sock.settimeout(5.0) # Increased timeout for stability
                            sock.connect((ip, port))
                        except Exception as e:
                            # print(f"❌ Connect failed {dev_id}: {e}")
                            sock = None
                            continue # Skip this register, try next (will try connect again)

                    try:
                        # 2. Construct RTU Frame
                        count_to_read = words
                        payload = struct.pack(">B B H H", slave, func, addr, count_to_read)
                        
                        crc = 0xFFFF
                        for ch in payload:
                            crc ^= ch
                            for _ in range(8):
                                if crc & 1:
                                    crc = (crc >> 1) ^ 0xA001
                                else:
                                    crc >>= 1
                        frame = payload + struct.pack("<H", crc)

                        # 3. Socket send/recv (Framed Read)
                        sock.send(frame)
                        
                        # Read Header: Slave + Func + ByteCount (3 bytes)
                        header = recv_strict(sock, 3)
                        
                        if not header:
                            # print(f"❌ No header {dev_id} {key}")
                            sock.close()
                            sock = None
                            continue # Retry next register
                        
                        rx_slave = header[0]
                        rx_func = header[1]
                        byte_count_or_code = header[2]

                        if rx_slave != slave:
                            sock.close()
                            sock = None
                            continue
                        
                        # Check Error
                        if rx_func >= 0x80:
                            # Error response: consume CRC (2 bytes)
                            _crc = recv_strict(sock, 2)
                            # print(f"⚠️ Modbus Exception {dev_id} {key}: Code {byte_count_or_code}")
                            continue

                        # Normal response: ByteCount + 2 (CRC)
                        expected_len = byte_count_or_code + 2
                        body = recv_strict(sock, expected_len)
                        
                        if not body:
                            sock.close()
                            sock = None
                            continue
                        
                        # Full frame acquired
                        data_bytes = body[:-2]
                                                    
                        val = None
                        
                        # Case: Coils/Inputs (Func 1 or 2)
                        if func in [1, 2]:
                            if len(data_bytes) > 0:
                                val = 1 if (data_bytes[0] & 1) else 0
                        # Case: Registers (Func 3 or 4)
                        else:
                            val = decode_buffer(data_bytes, datatype, scale)

                        if val is not None:
                            data[key] = val
                            read_success = True
                    
                    except Exception as e:
                        # print(f"⚠️ Read failed {dev_id} {key}: {e}")
                        if sock:
                            sock.close()
                        sock = None
                        pass

                if sock:
                    sock.close()

            else:
                print(f"⚠️ Unknown protocol '{protocol}' for {dev_id}, skip")
                write_log(f"Unknown protocol {protocol} for {dev_id}")
                time.sleep(1)
                continue

            # ✅ จัดการสถานะ
            if read_success:
                offline_count = 0
                if not online_status:
                    print(f"🟢 {dev_id} marked ONLINE")
                online_status = True

                data["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                data["device_id"] = dev_id
                data["online"] = True

                # ✅ Efficient Update
                READINGS_MEM[dev_id] = data
                _push_shared(dev_id, cfg, data)
                
                now = time.time()
                last = last_flush_by_dev.get(dev_id, 0)
                if now - last >= 900:
                    save_local(dev_id, data)
                    last_flush_by_dev[dev_id] = now

                print(f"[{data['timestamp']}] ✅ {dev_id} OK ({len(cfg.get('registers', []))} regs)")
            else:
                offline_count += 1
                # ✅ Always update shared state even on failure so UI/Alert see current status
                # If we have 1 or more failures, we can already signal 'warning' or 'offline'
                # but we only hard-mark 'online=False' after threshold
                
                is_actually_offline = (offline_count >= 10)
                if is_actually_offline and online_status:
                    print(f"🔴 {dev_id} marked OFFLINE (failed 10 times)")
                    online_status = False
                
                rec = READINGS_MEM.get(dev_id) or {}
                if not isinstance(rec, dict): rec = {}
                
                # Update status for others to see
                rec["online"] = online_status
                # timestamp keeps showing last SUCCESSFUL read, but 'online' flag tells the truth
                # OR we update timestamp to show we ATTEMPTED to read
                # rec["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                READINGS_MEM[dev_id] = rec
                _push_shared(dev_id, cfg, rec)
                
                # Small delay to prevent tight loop on connection errors
                time.sleep(0.5)

            # ✅ Smart Sleep
            elapsed = time.time() - start_time
            sleep_time = max(0, interval - elapsed)
            time.sleep(sleep_time)

        except Exception as e:
            offline_count += 1
            print(f"⚠️ Poll error for {dev_id}: {e}")
            
            is_actually_offline = (offline_count >= 10)
            if is_actually_offline:
                online_status = False
                
            rec = READINGS_MEM.get(dev_id) or {}
            if not isinstance(rec, dict): rec = {}
            rec["online"] = online_status
            READINGS_MEM[dev_id] = rec
            _push_shared(dev_id, cfg, rec)
            
            time.sleep(1)

    print(f"🛑 Device {dev_id} stopped.")


# ===========================================================
# ✅ Thread Management
# ===========================================================
active_threads = {}
stop_flags = {}
last_flush_by_dev = {}


def start_device_thread(dev_id, cfg):
    if dev_id in active_threads and active_threads[dev_id].is_alive():
        print(f"ℹ️ Thread for {dev_id} already running")
        return
    stop_flags[dev_id] = False
    t = threading.Thread(target=poll_device, args=(dev_id, cfg), daemon=True)
    active_threads[dev_id] = t
    t.start()
    print(f"🚀 Started thread for {dev_id}")


def stop_device_thread(dev_id):
    if dev_id in stop_flags:
        stop_flags[dev_id] = True
    print(f"🛑 Stop signal sent for {dev_id}")


# ===========================================================
# ✅ Reload Devices (เมื่อ convertors.json เปลี่ยน)
# ===========================================================
def reload_devices():
    try:
        devices = flatten_devices() or {}
        msg = f"🧠 Reloaded {len(devices)} devices from flatten_devices()"
        print(msg)
        write_log(msg)
        
        write_log(f"📂 Base Dir: {base_dir}")

        for dev_id, dev_cfg in devices.items():
            # ✅ โหลด template ก่อน
            template_path = dev_cfg.get("template")
            if template_path:
                template_full = os.path.join(base_dir, "device_templates", template_path.replace('/', os.sep) + ".json")
                if os.path.exists(template_full):
                    try:
                        with open(template_full, "r", encoding="utf-8") as f:
                            template_data = json.load(f)
                            # ✅ merge เฉพาะ fields สำคัญ เช่น registers
                            if "registers" in template_data:
                                dev_cfg["registers"] = template_data["registers"]
                            # ✅ merge ค่าพื้นฐาน (protocol/polling_interval จะไม่ override)
                            for k, v in template_data.items():
                                if k not in ["protocol", "modbus_ip", "modbus_port", "modbus_slave"]:
                                    dev_cfg.setdefault(k, v)
                        write_log(f"🧩 Loaded template for {dev_id}: {template_path}")
                    except Exception as e:
                        write_log(f"⚠️ Error loading template {template_path}: {e}")
                else:
                    write_log(f"⚠️ Template file not found: {template_full}")
            else:
                 if not dev_cfg.get("registers"):
                     write_log(f"⚠️ Device {dev_id} has no template and no registers.")

        # ✅ ตอนนี้ทุก device จะมี registers แล้ว
        for dev_id, cfg in devices.items():
            required = ["modbus_ip", "modbus_port", "modbus_slave", "polling_interval", "registers"]
            if all(k in cfg for k in required):
                start_device_thread(dev_id, cfg)
            else:
                missing = [k for k in required if k not in cfg]
                write_log(f"⚠️ Skip {dev_id}: missing {', '.join(missing)}")
                if 'registers' in missing:
                     write_log(f"   -> Template: {cfg.get('template')}")

    except Exception as e:
        write_log(f"❌ Reload devices error: {e}")

# ===========================================================
# ✅ Watcher (ตรวจ config เปลี่ยนทุก 5 วิ)
# ===========================================================
def watch_json(poll_interval=5):
    last_snapshot = None
    pid = _active_project_id()
    path = _project_config_path(pid or '')
    while True:
        try:
            if not os.path.exists(path):
                print(f"⚠️ Waiti ng for {path} to be created...")
                time.sleep(poll_interval)
                continue

            with open(path, "r", encoding="utf-8") as f:
                snapshot = f.read()

            if snapshot != last_snapshot:
                print("🔄 Convertor config changed — reloading...")
                reload_devices()
                last_snapshot = snapshot

        except Exception as e:
            print(f"⚠️ Watcher error: {e}")
        time.sleep(poll_interval)


# ===========================================================
# ✅ Entry Point
# ===========================================================
def start(poll_interval_watch=5):
    print("📟 Modbus Poller started (JSON Local Mode)")
    reload_devices()
    threading.Thread(target=watch_json, args=(poll_interval_watch,), daemon=True).start()
    threading.Thread(target=append_realtime, daemon=True).start()

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("🛑 Shutdown requested, stopping threads...")
        for dev in list(stop_flags.keys()):
            stop_device_thread(dev)
        time.sleep(2)
        print("✅ Exited cleanly.")


if __name__ == "__main__":
    start(5)
