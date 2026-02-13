"""
Simple migration helper to consolidate active_project.json into
services/backend/active_project.json and backup any existing root file.

Usage:
    python scripts/migrate_active_project.py --apply

Without --apply it will only report differences.
"""
import os, json, shutil, argparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKEND_ACTIVE = os.path.join(ROOT, 'services', 'backend', 'active_project.json')
ROOT_ACTIVE = os.path.join(ROOT, 'active_project.json')


def read_json(p):
    try:
        return json.load(open(p, 'r', encoding='utf-8'))
    except Exception:
        return None


def main(apply=False):
    backend = read_json(BACKEND_ACTIVE) if os.path.exists(BACKEND_ACTIVE) else None
    root = read_json(ROOT_ACTIVE) if os.path.exists(ROOT_ACTIVE) else None

    print(f"Backend active: {backend}")
    print(f"Root active:    {root}")

    if backend and root:
        if backend.get('active') != root.get('active'):
            print('Mismatch detected: backend and root active project differ')
            if apply:
                # Keep backend authoritative (do not override). Backup root and align root to backend.
                print('Backing up root active_project.json -> active_project.json.bak')
                shutil.copy(ROOT_ACTIVE, ROOT_ACTIVE + '.bak')
                print('Aligning root value to backend active file (backend wins)')
                with open(ROOT_ACTIVE, 'w', encoding='utf-8') as f:
                    json.dump(backend, f, indent=2, ensure_ascii=False)
                print('Alignment complete')
        else:
            print('No action needed; files match')
    elif root and not backend:
        print('Backend active missing; root exists. Will migrate to backend')
        if apply:
            os.makedirs(os.path.dirname(BACKEND_ACTIVE), exist_ok=True)
            shutil.copy(ROOT_ACTIVE, BACKEND_ACTIVE)
            print('Migration complete')
    elif backend and not root:
        print('Root missing; backend active exists. No action needed')
    else:
        print('No active_project.json found in either location')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    main(args.apply)
