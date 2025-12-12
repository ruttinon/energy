#!/usr/bin/env python3
import os, json, time, random
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PROJECTS_ROOT = os.path.join(ROOT, 'projects')
def load_config(pid):
    path = os.path.join(PROJECTS_ROOT, pid, 'ConfigDevice.json')
    if not os.path.exists(path): raise FileNotFoundError(path)
    with open(path,'r',encoding='utf-8') as f: return json.load(f)
def ensure_telemetry(pid):
    path = os.path.join(PROJECTS_ROOT, pid, 'telemetry.log'); open(path,'a').close(); return path

def device_sample(device):
    drv_name = device.get('driver')
    if drv_name:
        try:
            mod = __import__('drivers.' + drv_name.replace('-', '_'), fromlist=['*'])
            cls = None
            for obj in dir(mod):
                if 'Driver' in obj:
                    cls = getattr(mod, obj); break
            if cls:
                drv = cls(device.get('connection', {}))
                try:
                    drv.init(); val = drv.read_point(0, 'float'); drv.close();
                    return {'device_id': device.get('id','unknown'), 'values': {'v': val}}
                except Exception as e:
                    return {'device_id': device.get('id','unknown'), 'error': str(e)}
        except Exception as e:
            return {'device_id': device.get('id','unknown'), 'error':'driver import failed: '+str(e)}
    return {'device_id': device.get('id','unknown'), 'values': {'v': round(random.random()*100,2)}}

def run(pid):
    cfg = load_config(pid); devices = cfg.get('devices', [])
    if not devices: devices = [{'id':'demo-1','polling':{'interval_ms':1000}}]
    telemetry_path = ensure_telemetry(pid)
    print(f'[{pid}] Runner started. Writing telemetry to {telemetry_path}')
    try:
        while True:
            ts = time.time()
            for d in devices:
                sample = {'ts': ts, 'project_id': pid, 'device': device_sample(d)}
                with open(telemetry_path, 'a', encoding='utf-8') as f: f.write(json.dumps(sample, ensure_ascii=False) + '\n')
            intervals = [d.get('polling', {}).get('interval_ms', 1000)/1000.0 for d in devices]
            time.sleep(min(intervals) if intervals else 1.0)
    except KeyboardInterrupt:
        print(f'[{pid}] Runner stopping...')

def run_from_cli(pid):
    try: run(pid)
    except Exception as e: print('Runner error', e)
