#!/usr/bin/env python3
"""Manager: spawn one process per project folder and apply control.json commands"""
import os, time, multiprocessing as mp, json
from services.project_runner import run_from_cli
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PROJECTS_ROOT = os.path.join(ROOT, 'projects')
CONTROL_PATH = os.path.join(os.path.dirname(__file__), 'control.json')
STATUS_DIR = os.path.join(os.path.dirname(__file__), 'status')
os.makedirs(PROJECTS_ROOT, exist_ok=True); os.makedirs(STATUS_DIR, exist_ok=True)

def start_runner(pid, runners):
    if pid in runners and runners[pid].is_alive(): return
    p = mp.Process(target=run_from_cli, args=(pid,))
    p.start(); runners[pid] = p
    with open(os.path.join(STATUS_DIR, f"{pid}.status.json"), 'w', encoding='utf-8') as f: json.dump({'status':'running','pid':p.pid}, f)
    print(f'Started runner for {pid} (pid {p.pid})')

def stop_runner(pid, runners):
    p = runners.get(pid)
    if p and p.is_alive(): p.terminate(); p.join(timeout=2)
    runners.pop(pid, None)
    with open(os.path.join(STATUS_DIR, f"{pid}.status.json"), 'w', encoding='utf-8') as f: json.dump({'status':'stopped'}, f)

def apply_control_commands(runners):
    if not os.path.exists(CONTROL_PATH): return
    try:
        with open(CONTROL_PATH, 'r', encoding='utf-8') as f: cmds = json.load(f)
    except Exception:
        return
    for c in cmds:
        pid = c.get('project_id'); cmd = c.get('cmd')
        if cmd == 'start':
            if pid not in runners or not runners[pid].is_alive(): start_runner(pid, runners)
        elif cmd == 'stop':
            if pid in runners: stop_runner(pid, runners)
    try:
        with open(CONTROL_PATH, 'w', encoding='utf-8') as f: json.dump([], f)
    except Exception:
        pass

def main(poll_interval=2):
    runners = {}; seen = set()
    for name in os.listdir(PROJECTS_ROOT):
        path = os.path.join(PROJECTS_ROOT, name)
        if os.path.isdir(path): start_runner(name, runners); seen.add(name)
    try:
        while True:
            apply_control_commands(runners)
            for name in os.listdir(PROJECTS_ROOT):
                path = os.path.join(PROJECTS_ROOT, name)
                if os.path.isdir(path) and name not in seen:
                    start_runner(name, runners); seen.add(name)
            for pid, proc in list(runners.items()):
                if not proc.is_alive(): print(f'Runner for {pid} exited'); runners.pop(pid, None); seen.discard(pid)
            time.sleep(poll_interval)
    except KeyboardInterrupt:
        print('Shutting down manager...')
        for pid in list(runners.keys()): stop_runner(pid, runners)

if __name__ == '__main__': main()
