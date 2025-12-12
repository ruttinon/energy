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

# ===========================================================
# ✅ Add missing config_path (support all build environments)
# ===========================================================
try:
    base_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
except Exception:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ✅ path ใหม่ทั้งหมดอยู่ในโฟลเดอร์หลัก /data
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

def _projects_root():
    return os.path.abspath(os.path.join(base_dir, '..', '..', 'projects'))

def _active_project_id():
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
                out[did] = {
                    'modbus_ip': dev.get('modbus_ip') or (conv.get('settings') or {}).get('host') or conv.get('address'),
                    'modbus_port': int(dev.get('modbus_port') or (conv.get('settings') or {}).get('port') or conv.get('port') or 502),
                    'modbus_slave': int(dev.get('modbus_slave') or dev.get('address') or 1),
                    'polling_interval': int(dev.get('polling_interval') or 3),
                    'protocol': _normalize_protocol(dev.get('protocol') or conv.get('protocol') or 'modbus_tcp'),
                    'convertor_id': conv.get('id'),
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

def read_modbus_tcp_raw(ip, port, unit_id, function, address, count, timeout=2):
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
    """เพิ่มค่าใหม่พร้อม timestamp ทุก 1 นาที"""
    os.makedirs("data", exist_ok=True)
    while True:
        try:
            readings = load_readings()
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            data = {}

            # เพิ่มข้อมูลใหม่แต่ละ device
            for device_id, values in readings.items():
                entry = {"timestamp": timestamp}
                entry.update(values)
                data.setdefault(device_id, []).append(entry)

                # เก็บแค่ย้อนหลัง 1000 record ต่อ device (กันไฟล์บวม)
                if len(data[device_id]) > 1000:
                    data[device_id] = data[device_id][-1000:]

            pass

            print(f"🕒 Realtime data logged at {timestamp}")
        except Exception as e:
            print("🔥 Realtime Logger Error:", e)

        time.sleep(60)  # ✅ เก็บทุก 1 นาที

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
def read_modbus_value(client, slave_id, address, datatype="int16", scale=1, function=3, words=2):
    """
    อ่านค่าจาก Modbus Register รองรับหลายรูปแบบ datatype:
    - int16, uint16, int32, uint32
    - float32_ABCD_be, float32_DCBA_le, float32_BADC, float32_CDAB
    """
    try:
        # ✅ อ่านจาก Function Code ที่กำหนด
        if function == 3:
            try:
                rr = client.read_holding_registers(address=address, count=words, slave=slave_id)
            except TypeError:
                rr = client.read_holding_registers(address, words, unit=slave_id)
        elif function == 4:
            try:
                rr = client.read_input_registers(address=address, count=words, slave=slave_id)
            except TypeError:
                rr = client.read_input_registers(address, words, unit=slave_id)
        else:
            print(f"⚠️ Unsupported function {function} at addr {address}")
            return None

        # ✅ ตรวจสอบผลลัพธ์
        if not rr or rr.isError():
            print(f"⚠️ Read error func={function} addr={address}")
            return None

        regs = rr.registers
        if not regs:
            return None

        # ✅ รวม register เป็น byte array (2 bytes ต่อ 1 register)
        data_bytes = b"".join(int(x).to_bytes(2, "big") for x in regs)
        dtype = (datatype or "").lower()

        # ✅ Decode ตามประเภทข้อมูล
        val = None
        if "float32" in dtype:
            try:
                # print raw bytes สำหรับ debug
                print(f"📊 Raw bytes for {address}: {data_bytes.hex(' ')}")

                # ทดลอง decode ทั้ง 4 แบบ
                val_abcd = struct.unpack(">f", data_bytes[:4])[0]
                val_dcba = struct.unpack("<f", data_bytes[:4])[0]
                swapped_badc = data_bytes[2:4] + data_bytes[0:2]
                val_badc = struct.unpack(">f", swapped_badc)[0]
                # ✅ แก้การสลับ byte order แบบ CDAB (word swapped, little endian)
                # ✅ ใช้แบบนี้แทน
                swapped_cdab = data_bytes[2:4] + data_bytes[0:2]
                val_cdab = struct.unpack(">f", swapped_cdab)[0]   # >f = big-endian (เพราะ byte ในแต่ละ reg ไม่สลับ)

                print(f"🧠 Test decode → ABCD={val_abcd:.3f}, DCBA={val_dcba:.3f}, BADC={val_badc:.3f}, CDAB={val_cdab:.3f}")

                # ใช้ตาม datatype ที่ระบุ
                if "_abcd" in dtype or dtype.endswith("_be"):
                    val = val_abcd
                elif "_dcba" in dtype or dtype.endswith("_le"):
                    val = val_dcba
                elif "_badc" in dtype:
                    val = val_badc
                elif "_cdab" in dtype:
                    val = val_cdab
                else:
                    # default → auto-detect โดยเลือกค่าที่ไม่ใช่ 0
                    candidates = [val_abcd, val_dcba, val_badc, val_cdab]
                    val = next((v for v in candidates if abs(v) > 0.1), val_abcd)

            except Exception as e:
                print(f"⚠️ Float decode error at addr {address}: {e}")
                return None

        elif "int32" in dtype:
            val = struct.unpack(">i", data_bytes[:4])[0]
        elif "uint32" in dtype:
            val = struct.unpack(">I", data_bytes[:4])[0]
        elif "int16" in dtype:
            val = regs[0]
            if val >= 0x8000:
                val -= 0x10000
        elif "uint16" in dtype:
            val = regs[0]
        else:
            val = regs[0]

        # ✅ คูณ/หาร scale
        return round(val / float(scale or 1), 6) if val is not None else None

    except Exception as e:
        print(f"❌ Error reading {datatype} at addr {address}: {e}")
        return None


# ===========================================================
# ✅ Polling Thread (รองรับ modbus_tcp + tcp)
# ===========================================================
def poll_device(dev_id, cfg):
    ip = cfg.get("modbus_ip")
    port = cfg.get("modbus_port", 502)
    slave = cfg.get("modbus_slave", 1)
    interval = cfg.get("polling_interval", 5)
    protocol = (cfg.get("protocol") or "modbus_tcp").lower()
    convertor_id = cfg.get("convertor_id", "unknown")

    offline_count = 0
    online_status = False

    print(f"📡 Start polling {dev_id} ({protocol}) {ip}:{port}, slave={slave}")
    write_log(f"Start polling {dev_id} {ip}:{port} slave={slave} protocol={protocol}")

    while not stop_flags.get(dev_id, False):
        try:
            data = {}
            read_success = False

            # ✅ โหมด Modbus TCP (ผ่าน pymodbus)
            if protocol == "modbus_tcp":
                use_raw = ModbusTcpClient is None
                client = None
                if not use_raw:
                    client = ModbusTcpClient(ip, port=port, timeout=3)
                    if not client.connect():
                        use_raw = True
                for reg in cfg.get("registers", []):
                    key = reg["key"]
                    addr = reg["address"]
                    func = reg.get("function", 3)
                    words = reg.get("words", 2)
                    datatype = reg.get("datatype", "int16")
                    scale = reg.get("scale", 1)
                    if not use_raw and client:
                        val = read_modbus_value(client, slave, addr, datatype, scale, func, words)
                        if val is None and func == 3:
                            val = read_modbus_value(client, slave, addr, datatype, scale, 4, words)
                    else:
                        regs = read_modbus_tcp_raw(ip, port, slave, func, addr, words)
                        if regs is None and func == 3:
                            regs = read_modbus_tcp_raw(ip, port, slave, 4, addr, words)
                        val = None
                        if regs:
                            if "int32" in datatype.lower() and len(regs) >= 2:
                                raw = (regs[0] << 16) | regs[1]
                                if raw >= 0x80000000:
                                    raw -= 0x100000000
                                val = raw / float(scale)
                            elif "int16" in datatype.lower():
                                v = regs[0]
                                if v >= 0x8000:
                                    v -= 0x10000
                                val = v / float(scale)
                            elif len(regs) > 0:
                                val = regs[0] / float(scale)
                    data[key] = val
                    if val is not None:
                        read_success = True
                if client:
                    client.close()

            # ✅ โหมด TCP (RTU over TCP)
            elif protocol == "tcp":
                for reg in cfg.get("registers", []):
                    key = reg["key"]
                    addr = reg["address"]
                    func = reg.get("function", 3)
                    words = reg.get("words", 2)
                    datatype = reg.get("datatype", "int16")
                    scale = reg.get("scale", 1)

                    # สร้าง Frame Modbus RTU
                    payload = struct.pack(">B B H H", slave, func, addr, words)
                    crc = 0xFFFF
                    for ch in payload:
                        crc ^= ch
                        for _ in range(8):
                            if crc & 1:
                                crc = (crc >> 1) ^ 0xA001
                            else:
                                crc >>= 1
                    frame = payload + struct.pack("<H", crc)

                    # ส่งผ่าน TCP Socket
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(3)
                    s.connect((ip, port))
                    s.send(frame)
                    reply = s.recv(1024)
                    s.close()

                    if len(reply) > 5 and reply[0] == slave and reply[1] == func:
                        byte_count = reply[2]
                        regs = []
                        for i in range(0, byte_count, 2):
                            regs.append((reply[3 + i] << 8) + reply[4 + i])

                        # แปลงค่า
                        val = None
                        if "int32" in datatype.lower() and len(regs) >= 2:
                            raw = (regs[0] << 16) | regs[1]
                            if raw >= 0x80000000:
                                raw -= 0x100000000
                            val = raw / float(scale)
                        elif "int16" in datatype.lower():
                            val = regs[0]
                            if val >= 0x8000:
                                val -= 0x10000
                            val = val / float(scale)
                        elif len(regs) > 0:
                            val = regs[0] / float(scale)

                        if val is not None:
                            data[key] = val
                            read_success = True
                    else:
                        if func == 3:
                            # retry with function 4
                            payload = struct.pack(">B B H H", slave, 4, addr, words)
                            crc = 0xFFFF
                            for ch in payload:
                                crc ^= ch
                                for _ in range(8):
                                    if crc & 1:
                                        crc = (crc >> 1) ^ 0xA001
                                    else:
                                        crc >>= 1
                            frame = payload + struct.pack("<H", crc)
                            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            s.settimeout(3)
                            s.connect((ip, port))
                            s.send(frame)
                            reply = s.recv(1024)
                            s.close()
                            if len(reply) > 5 and reply[0] == slave and reply[1] == 4:
                                byte_count = reply[2]
                                regs = []
                                for i in range(0, byte_count, 2):
                                    regs.append((reply[3 + i] << 8) + reply[4 + i])
                                val = None
                                if "int32" in datatype.lower() and len(regs) >= 2:
                                    raw = (regs[0] << 16) | regs[1]
                                    if raw >= 0x80000000:
                                        raw -= 0x100000000
                                    val = raw / float(scale)
                                elif "int16" in datatype.lower():
                                    val = regs[0]
                                    if val >= 0x8000:
                                        val -= 0x10000
                                    val = val / float(scale)
                                elif len(regs) > 0:
                                    val = regs[0] / float(scale)
                                if val is not None:
                                    data[key] = val
                                    read_success = True
                            else:
                                print(f"⚠️ No valid reply for {dev_id}:{key} (addr={addr})")

            else:
                print(f"⚠️ Unknown protocol '{protocol}' for {dev_id}, skip")
                write_log(f"Unknown protocol {protocol} for {dev_id}")
                time.sleep(interval)
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

                readings = load_readings()
                readings[dev_id] = data
                save_readings(readings)
                now = time.time()
                last = last_flush_by_dev.get(dev_id, 0)
                if now - last >= 900:
                    save_local(dev_id, data)
                    last_flush_by_dev[dev_id] = now
                write_log(f"{dev_id} read OK")

                print(f"[{data['timestamp']}] ✅ {dev_id} OK ({len(cfg.get('registers', []))} regs)")
            else:
                offline_count += 1
                if offline_count >= 3 and online_status:
                    online_status = False
                    print(f"🔴 {dev_id} marked OFFLINE (no data)")
                    readings = load_readings()
                    if dev_id in readings:
                        readings[dev_id]["online"] = False
                        save_readings(readings)

            time.sleep(interval)

        except Exception as e:
            offline_count += 1
            print(f"⚠️ Poll error for {dev_id}: {e}")
            write_log(f"Poll error for {dev_id}: {e}")
            if offline_count >= 3 and online_status:
                online_status = False
                print(f"🔴 {dev_id} marked OFFLINE (exception)")
            time.sleep(interval)

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
        print(f"🧠 Reloaded {len(devices)} devices from flatten_devices()")

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
                        print(f"🧩 Loaded template for {dev_id}: {template_path}")
                    except Exception as e:
                        print(f"⚠️ Error loading template {template_path}: {e}")
                else:
                    print(f"⚠️ Template file not found: {template_full}")

        # ✅ ตอนนี้ทุก device จะมี registers แล้ว
        for dev_id, cfg in devices.items():
            required = ["modbus_ip", "modbus_port", "modbus_slave", "polling_interval", "registers"]
            if all(k in cfg for k in required):
                start_device_thread(dev_id, cfg)
            else:
                print(f"⚠️ Skip {dev_id}: missing {', '.join([k for k in required if k not in cfg])}")

    except Exception as e:
        print(f"❌ Reload devices error: {e}")

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
