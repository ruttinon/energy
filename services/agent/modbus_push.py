#!/usr/bin/env python3
# modbus_push.py (enhanced)
# Features:
# - config.json support (override CLI args)
# - fake mode for testing (generate dummy readings)
# - heartbeat to backend
# - MQTT publish (optional) with fallback to HTTP ingest
# - offline queue (outbox.json) for reliable delivery when network down
# - upload logs to backend
# - update-check / download-update endpoints
# - improved command handling (set_interval, set_target, set_protocol, restart_agent, enable_fake_mode, download_update)
# - robust error handling and readable logs
#
# NOTE: auto-replace/execute downloaded binary is NOT enabled here for safety.
# If you want full auto-update (download and replace executable + restart), ask and I'll add it explicitly.

import argparse
import json
import os
import time
import socket
import struct
import requests
import traceback
import threading
import random
from datetime import datetime

# optional mqtt
try:
    import paho.mqtt.client as mqtt
except Exception:
    mqtt = None

# ------------ Defaults / Filenames ------------
OUTBOX_FILE = "outbox.json"
LOG_FILE = "agent_local.log"
CONFIG_FILE = "config.json"
UPDATE_FILE = "agent_update.bin"
try:
    import sys
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    os.chdir(base_dir)
except Exception:
    pass

# Defaults for zero-config build (override via ENV ENERGY_*_DEFAULT)
DEFAULT_BACKEND = os.getenv("ENERGY_BACKEND_DEFAULT") or "http://127.0.0.1:8000"
DEFAULT_USER = os.getenv("ENERGY_USER_DEFAULT") or "AGENT_USER"
DEFAULT_PASS = os.getenv("ENERGY_PASS_DEFAULT") or "SECRET"
DEFAULT_PROJECT = os.getenv("ENERGY_PROJECT_DEFAULT") or "CPRAM-639ec8"

# ------------ Helpers ------------
def now_ts():
    return int(time.time())

def write_local_log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def save_outbox_queue(queue_list):
    try:
        with open(OUTBOX_FILE, "w", encoding="utf-8") as f:
            json.dump(queue_list, f, ensure_ascii=False, indent=2)
    except Exception as e:
        write_local_log(f"[ERROR] save_outbox_queue failed: {e}")

def load_outbox_queue():
    if not os.path.exists(OUTBOX_FILE):
        return []
    try:
        with open(OUTBOX_FILE, "r", encoding="utf-8") as f:
            return json.load(f) or []
    except Exception:
        return []

# ------------ Modbus read functions ------------
def read_modbus_tcp(ip, port, unit_id, function, address, count, timeout=5.0):
    try:
        tid = int(time.time() * 1000) & 0xFFFF
        pid = 0
        length = 6
        pdu = struct.pack('>B B H H', unit_id, function, address, count)
        mbap = struct.pack('>H H H', tid, pid, length)
        req = mbap + pdu

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.send(req)
        data = s.recv(2048)
        s.close()

        if len(data) < 9:
            write_local_log(f"[WARN] No/short response from {ip}:{port}")
            return None

        # data[6:9] contains unit id, function, byte_count
        _, func, byte_count = struct.unpack('>B B B', data[6:9])
        if func != function:
            write_local_log(f"[WARN] Wrong function code response from device ({func} != {function})")
            return None

        regs = []
        for i in range(0, byte_count, 2):
            regs.append((data[9 + i] << 8) + data[10 + i])
        return regs
    except Exception as e:
        write_local_log(f"[ERROR] TCP read failed {ip}:{port} -> {e}")
        return None

def read_modbus_rtu_over_tcp(ip, port, unit_id, function, address, count, timeout=5.0):
    try:
        payload = struct.pack('>B B H H', unit_id, function, address, count)
        # CRC16
        crc = 0xFFFF
        for ch in payload:
            crc ^= ch
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc >>= 1
        frame = payload + struct.pack('<H', crc)

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.send(frame)
        reply = s.recv(2048)
        s.close()

        if len(reply) < 5:
            write_local_log("[WARN] RTU/TCP short reply")
            return None
        if reply[0] != unit_id or reply[1] != function:
            write_local_log("[WARN] RTU/TCP wrong slave/function")
            return None

        byte_count = reply[2]
        regs = []
        for i in range(0, byte_count, 2):
            regs.append((reply[3 + i] << 8) + reply[4 + i])
        return regs
    except Exception as e:
        write_local_log(f"[ERROR] RTU/TCP failed {ip}:{port} -> {e}")
        return None

def decode_registers(regs, datatype, scale):
    if regs is None:
        return None
    dt = (datatype or "").lower()
    try:
        scale = float(scale or 1)
    except Exception:
        scale = 1.0
    try:
        if "int32" in dt and len(regs) >= 2:
            raw = (int(regs[0]) << 16) | (int(regs[1]) & 0xFFFF)
            if raw >= 0x80000000:
                raw -= 0x100000000
            return round(raw / scale, 6)
        if "uint32" in dt and len(regs) >= 2:
            raw = (int(regs[0]) << 16) | (int(regs[1]) & 0xFFFF)
            return round(raw / scale, 6)
        if "int16" in dt and regs:
            v = int(regs[0])
            if v >= 0x8000:
                v -= 0x10000
            return round(v / scale, 6)
        if regs:
            return round(int(regs[0]) / scale, 6)
    except Exception as e:
        write_local_log(f"[ERROR] decode failed: {e}")
        return None
    return None

# ------------ Agent Core ------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend")
    ap.add_argument("--project")
    ap.add_argument("--token")
    ap.add_argument("--username")
    ap.add_argument("--password")
    ap.add_argument("--device-id")
    ap.add_argument("--name")
    ap.add_argument("--converter")
    ap.add_argument("--template")
    ap.add_argument("--ip")
    ap.add_argument("--port", type=int)
    ap.add_argument("--slave", type=int)
    ap.add_argument("--interval", type=int, default=5)
    ap.add_argument("--protocol", choices=["modbus_tcp", "tcp"], default="modbus_tcp")
    ap.add_argument("--timeout", type=float, default=8.0)
    ap.add_argument("--mqtt-broker")
    ap.add_argument("--mqtt-port", type=int, default=1883)
    ap.add_argument("--mqtt-topic", default="energylink/ingest")
    ap.add_argument("--fake", action="store_true")
    ap.add_argument("--heartbeat-interval", type=int, default=30)
    ap.add_argument("--outbox-file", default=OUTBOX_FILE)
    args = ap.parse_args()

    if os.path.exists(CONFIG_FILE):
        try:
            cfg = json.load(open(CONFIG_FILE, "r", encoding="utf-8"))
            for k, v in cfg.items():
                if hasattr(args, k):
                    setattr(args, k, v if getattr(args, k) is None else type(getattr(args, k))(v))
            write_local_log("[INFO] Loaded config.json and applied overrides")
        except Exception as e:
            write_local_log(f"[WARN] Failed to load config.json: {e}")

    if not args.backend:
        args.backend = os.getenv("ENERGY_BACKEND")

    session = requests.Session()
    if not args.token:
        # fill from ENV first, then defaults
        args.backend = args.backend or os.getenv("ENERGY_BACKEND") or DEFAULT_BACKEND
        args.username = args.username or os.getenv("ENERGY_USER") or DEFAULT_USER
        args.password = args.password or os.getenv("ENERGY_PASS") or DEFAULT_PASS
        args.project = args.project or os.getenv("ENERGY_PROJECT") or DEFAULT_PROJECT
        if not args.backend or not args.username or not args.password:
            write_local_log("[FATAL] Missing backend/username/password")
            return
        try:
            b = args.backend.rstrip("/")
            if args.project:
                r = session.post(f"{b}/api/login_user", json={"username": args.username, "password": args.password, "project_id": args.project}, timeout=10)
                r.raise_for_status()
            else:
                r = session.post(f"{b}/api/login_user_any", json={"username": args.username, "password": args.password}, timeout=10)
                r.raise_for_status()
                pj = r.json().get("project_id")
                if pj:
                    args.project = pj
            write_local_log("[LOGIN] session established")
        except Exception as e:
            write_local_log(f"[FATAL] Login failed: {e}")
            return

    # Template load (optional; will fetch from backend if missing)
    regs = []
    tpl = {}
    if args.template:
        try:
            tpl = json.load(open(args.template, "r", encoding="utf-8"))
            regs = tpl.get("registers", [])
        except Exception as e:
            write_local_log(f"[WARN] Cannot load local template {args.template}: {e}")

    # Basic agent metadata
    backend = args.backend.rstrip("/")
    project = args.project
    token = args.token
    device_id = args.device_id
    device_name = args.name
    converter = args.converter
    target_ip = args.ip
    target_port = args.port
    slave = args.slave
    interval = max(1, int(args.interval))
    protocol = args.protocol
    timeout = float(args.timeout)
    mqtt_host = args.mqtt_broker
    mqtt_port = int(args.mqtt_port) if args.mqtt_broker else None
    mqtt_topic = args.mqtt_topic
    fake_mode = bool(args.fake)
    heartbeat_interval = int(args.heartbeat_interval)
    outbox_file = args.outbox_file

    write_local_log("===========================================")
    write_local_log("  MODBUS AGENT STARTED")
    write_local_log(f"  Backend: {backend}")
    write_local_log(f"  Project: {project}  Device: {device_id} ({device_name})")
    write_local_log(f"  Target: {target_ip}:{target_port}  Protocol: {protocol}")
    write_local_log("===========================================")

    # MQTT client optional
    mclient = None
    if mqtt and mqtt_host:
        try:
            mclient = mqtt.Client()
            mclient.connect(mqtt_host, mqtt_port, 60)
            mclient.loop_start()
            write_local_log(f"[MQTT] Connected to {mqtt_host}:{mqtt_port}")
        except Exception as e:
            write_local_log(f"[MQTT] Connect failed: {e}")
            mclient = None

    # fetch device config from backend if missing (login/cookie mode)
    if (not token) and ((not regs) or (not target_ip) or (not target_port) or (not slave)):
        try:
            r = session.get(f"{backend}/api/projects/{project}/devices", timeout=10)
            devs = r.json().get('devices', []) if r.status_code == 200 else []
            info = next((d for d in devs if str(d.get('id')) == str(device_id)), None)
            if info:
                target_ip = target_ip or info.get('modbus_ip')
                target_port = target_port or int(info.get('modbus_port') or 502)
                slave = slave or int(info.get('modbus_slave') or 1)
                tref = info.get('template_ref')
                if not regs and tref:
                    try:
                        t = session.get(f"{backend}/api/templates/device_content?path={requests.utils.quote(tref, safe='')}", timeout=10)
                        if t.status_code == 200:
                            tpl = t.json(); regs = tpl.get('registers', [])
                    except Exception as e:
                        write_local_log(f"[WARN] template fetch failed: {e}")
                write_local_log("[CFG] device config loaded from server")
            else:
                write_local_log("[WARN] device config not found on server")
        except Exception as e:
            write_local_log(f"[WARN] device list fetch failed: {e}")

    devices_cfg = []
    try:
        devs = []
        if not token:
            r = session.get(f"{backend}/api/projects/{project}/devices", timeout=10)
            devs = r.json().get('devices', []) if r.status_code == 200 else []
        if device_id:
            devs = [d for d in devs if str(d.get('id')) == str(device_id)]
        for d in devs:
            item = {
                'id': str(d.get('id')),
                'name': d.get('name') or str(d.get('id')),
                'ip': d.get('modbus_ip'),
                'port': int(d.get('modbus_port') or 502),
                'slave': int(d.get('modbus_slave') or 1),
                'converter': d.get('converter'),
                'regs': []
            }
            tref = d.get('template_ref')
            if tref:
                t = session.get(f"{backend}/api/templates/device_content?path={requests.utils.quote(tref, safe='')}", timeout=10)
                if t.status_code == 200:
                    item['regs'] = (t.json().get('registers') or [])
            devices_cfg.append(item)
    except Exception:
        pass
    if not devices_cfg and target_ip and target_port and slave and regs:
        devices_cfg = [{'id': device_id, 'name': device_name, 'ip': target_ip, 'port': target_port, 'slave': slave, 'converter': converter, 'regs': regs}]
    if not devices_cfg:
        write_local_log("[FATAL] no devices to poll")
        return

    outbox = load_outbox_queue()

    # helper: send payload (MQTT preferred, fallback HTTP). store in outbox on failure.
    def send_payload(payload):
        payload_json = json.dumps(payload, ensure_ascii=False)
        # try mqtt first
        if mclient:
            try:
                mclient.publish(mqtt_topic, payload_json, qos=0)
                write_local_log(f"[MQTT] published topic={mqtt_topic} size={len(payload_json)}")
                return True
            except Exception as e:
                write_local_log(f"[MQTT] publish failed: {e}")
        # try HTTP
        try:
            if token:
                url = f"{backend}/public/ingest"
                r = requests.post(url, json=payload, timeout=10)
            else:
                url = f"{backend}/api/ingest"
                r = session.post(url, json=payload, timeout=10)
            write_local_log(f"[HTTP] {r.status_code} project={project} device={device_id} keys={len(payload.get('values', {}))}")
            if r.status_code >= 200 and r.status_code < 300:
                return True
            else:
                write_local_log(f"[HTTP] non-OK response body={r.text}")
        except Exception as e:
            write_local_log(f"[ERROR] HTTP send failed: {e}")
        # if here -> failed, push to outbox
        outbox.append({"ts": now_ts(), "payload": payload})
        save_outbox_queue(outbox)
        write_local_log("[OUTBOX] queued payload for later delivery")
        return False

    # helper: flush outbox
    def flush_outbox():
        nonlocal outbox
        if not outbox:
            return
        write_local_log(f"[OUTBOX] Attempting flush {len(outbox)} item(s)")
        remaining = []
        for item in outbox:
            p = item.get("payload")
            try:
                ok = False
                # try mqtt
                if mclient:
                    try:
                        mclient.publish(mqtt_topic, json.dumps(p, ensure_ascii=False), qos=0)
                        ok = True
                    except Exception:
                        ok = False
                if not ok:
                    try:
                        if token:
                            r = requests.post(f"{backend}/public/ingest", json=p, timeout=10)
                        else:
                            r = session.post(f"{backend}/api/ingest", json=p, timeout=10)
                        ok = 200 <= r.status_code < 300
                    except Exception:
                        ok = False
                if not ok:
                    remaining.append(item)
                    write_local_log("[OUTBOX] send failed, keep in queue")
                else:
                    write_local_log("[OUTBOX] sent queued payload")
            except Exception as e:
                remaining.append(item)
                write_local_log(f"[OUTBOX] flush exception: {e}")
        outbox = remaining
        save_outbox_queue(outbox)

    # heartbeat thread (POST /public/agent/heartbeat)
    stop_threads = False
    def heartbeat_loop():
        while not stop_threads:
            try:
                ts = now_ts()
                for dv in devices_cfg:
                    hb = {"project": project, "device_id": str(dv.get('id')), "device_name": dv.get('name'), "ts": ts, "online": True}
                    try:
                        requests.post(f"{backend}/public/agent/heartbeat", json=hb, timeout=6)
                    except Exception:
                        pass
                flush_outbox()
            except Exception as e:
                write_local_log(f"[HEARTBEAT] exception: {e}")
            for _ in range(heartbeat_interval):
                if stop_threads:
                    break
                time.sleep(1)

    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_thread.start()

    # update-check routine (non-blocking)
    last_update_check = 0
    update_check_interval = 60 * 60  # hourly by default

    def check_update():
        nonlocal last_update_check
        try:
            if now_ts() - last_update_check < update_check_interval:
                return None
            last_update_check = now_ts()
            url = f"{backend}/public/agent/update-check?project={project}&device_id={device_id}"
            try:
                r = requests.get(url, timeout=10)
                j = r.json()
                return j
            except Exception as e:
                write_local_log(f"[UPDATE] check failed: {e}")
                return None
        except Exception as e:
            write_local_log(f"[UPDATE] exception: {e}")
            return None

    def download_update_file(download_url):
        try:
            r = requests.get(download_url, stream=True, timeout=30)
            if r.status_code == 200:
                with open(UPDATE_FILE, "wb") as fh:
                    for chunk in r.iter_content(1024 * 8):
                        if chunk:
                            fh.write(chunk)
                write_local_log(f"[UPDATE] downloaded update to {UPDATE_FILE}")
                return True
            else:
                write_local_log(f"[UPDATE] download failed status {r.status_code}")
        except Exception as e:
            write_local_log(f"[UPDATE] download exception: {e}")
        return False

    # Poll commands (pull from backend)
    last_cmd_ts = 0
    control_interval = 10

    def poll_commands():
        nonlocal fake_mode, interval, target_ip, target_port, slave, protocol
        try:
            url = f"{backend}/public/commands/pull?project_id={project}&device_id={device_id}&token={token}"
            try:
                r = requests.get(url, timeout=10)
                j = r.json() if r.status_code == 200 else {}
            except Exception:
                j = {}
            acks = []
            for item in j.get('commands') or []:
                cid = item.get('id')
                cmd = item.get('cmd') or {}
                action = (cmd.get('action') or '').lower()
                write_local_log(f"[CMD] got {action}")
                if action == 'set_interval':
                    try:
                        interval = int(cmd.get('value') or interval)
                        write_local_log(f"[CMD] set_interval -> {interval}")
                    except Exception:
                        pass
                elif action == 'set_target':
                    try:
                        target_ip = cmd.get('ip') or target_ip
                        target_port = int(cmd.get('port') or target_port)
                        slave = int(cmd.get('slave') or slave)
                        write_local_log(f"[CMD] set_target -> {target_ip}:{target_port} slave={slave}")
                    except Exception:
                        pass
                elif action == 'set_protocol':
                    p = (cmd.get('protocol') or protocol)
                    if p in ['modbus_tcp', 'tcp']:
                        protocol = p
                        write_local_log(f"[CMD] set_protocol -> {protocol}")
                elif action == 'restart_agent':
                    # gracefully request restart by writing a restart marker file
                    write_local_log("[CMD] restart_agent requested (please restart the process manually or implement restart handler)")
                    # Optionally create a file for external supervisor to restart
                    open("agent_restart.request", "w").write(str(now_ts()))
                elif action == 'enable_fake_mode':
                    fake_mode = True
                    write_local_log("[CMD] enable_fake_mode -> True")
                elif action == 'disable_fake_mode':
                    fake_mode = False
                    write_local_log("[CMD] disable_fake_mode -> False")
                elif action == 'download_update':
                    url_dl = cmd.get('url')
                    if url_dl:
                        ok = download_update_file(url_dl)
                        write_local_log(f"[CMD] download_update -> {ok}")
                # add other commands as needed...
                acks.append(cid)
            if acks:
                try:
                    requests.post(f"{backend}/public/commands/ack", json={"project_id": project, "token": token, "device_id": device_id, "ids": acks}, timeout=10)
                    write_local_log(f"[CMD] ack {len(acks)}")
                except Exception:
                    pass
        except Exception as e:
            write_local_log(f"[CMD] poll exception: {e}")

    # Main loop
    try:
        while True:
            for dv in devices_cfg:
                device_id = str(dv.get('id'))
                device_name = dv.get('name') or device_id
                regs = dv.get('regs') or []
                target_ip = dv.get('ip')
                target_port = int(dv.get('port') or 502)
                slave = int(dv.get('slave') or 1)
                converter = dv.get('converter') or converter
                values = {}

                for r in regs:
                    key = r.get("key")
                    addr = int(r.get("address") or 0)
                func = int(r.get("function") or 3)
                words = int(r.get("words") or 2)
                datatype = r.get("datatype") or "int16"
                scale = float(r.get("scale") or 1)

                write_local_log(f"[READ] key={key} addr={addr} func={func} words={words} dt={datatype} proto={protocol}")

                rr = None
                # fake mode shortcut
                if fake_mode:
                    # random small jitter around a base value
                    val_fake = round(random.uniform(0.0, 100.0), 6)
                    values[key] = val_fake
                    write_local_log(f"[FAKE] {key} -> {val_fake}")
                    continue

                # try reading (several fallbacks)
                try:
                    if protocol == "modbus_tcp":
                        rr = read_modbus_tcp(target_ip, target_port, slave, func, addr, words, timeout=timeout)
                        # try function 4 if read function 3 failed and function==3
                        if rr is None and func == 3:
                            rr = read_modbus_tcp(target_ip, target_port, slave, 4, addr, words, timeout=timeout)
                        # try default port 502 if different
                        if rr is None and target_port != 502:
                            rr = read_modbus_tcp(target_ip, 502, slave, func, addr, words, timeout=timeout)
                        # fallback rtu-over-tcp
                        if rr is None:
                            rr = read_modbus_rtu_over_tcp(target_ip, target_port, slave, func, addr, words, timeout=timeout)
                    else:
                        rr = read_modbus_rtu_over_tcp(target_ip, target_port, slave, func, addr, words, timeout=timeout)
                        if rr is None and func == 3:
                            rr = read_modbus_rtu_over_tcp(target_ip, target_port, slave, 4, addr, words, timeout=timeout)
                        if rr is None and target_port != 502:
                            rr = read_modbus_rtu_over_tcp(target_ip, 502, slave, func, addr, words, timeout=timeout)
                except Exception as e:
                    write_local_log(f"[ERROR] modbus read exception: {e}")
                    rr = None

                write_local_log(f"[RAW] rr={rr}")

                val = decode_registers(rr, datatype, scale)
                values[key] = val
                write_local_log(f"[VAL] key={key} value={val}")

            payload = {
                "project_id": project,
                "token": token,
                "device_id": device_id,
                "device_name": device_name,
                "converter": converter,
                "ts": now_ts(),
                "values": values
            }

            non_null = sum(1 for v in values.values() if v is not None)
            write_local_log(f"[LOOP] keys={len(values)} non_null={non_null}")

            # try send
            send_payload(payload)

            # error/log upload hint: if many None values, send a log
            if non_null == 0:
                try:
                    requests.post(f"{backend}/public/agent/log", json={
                        "project": project, "device_id": device_id,
                        "ts": now_ts(), "level": "warn",
                        "message": "all values None for this cycle"
                    }, timeout=5)
                except Exception:
                    pass

            # check update occasionally
            try:
                j = check_update()
                if j and j.get("update"):
                    # If server asks to download, do it
                    dl = j.get("url")
                    if dl:
                        write_local_log(f"[UPDATE] server requested update download {dl}")
                        download_update_file(dl)
            except Exception:
                pass

            # poll commands periodically
            now = time.time()
            if now - last_cmd_ts >= control_interval:
                poll_commands()
                last_cmd_ts = now

            # sleep
            for _ in range(max(1, interval)):
                time.sleep(1)

    except KeyboardInterrupt:
        write_local_log("[MAIN] Interrupted by user")
    except Exception as e:
        write_local_log(f"[FATAL] Unhandled exception: {e}")
        traceback.print_exc()
    finally:
        # stop heartbeat thread
        stop_threads = True
        write_local_log("[MAIN] Exiting")

if __name__ == "__main__":
    main()
