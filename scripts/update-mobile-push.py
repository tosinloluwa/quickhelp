#!/usr/bin/env python3
"""Install/roll back the three mobile push-continuity files; Python 3.6+."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

FILES = ('api.php', 'app.js', 'index.php')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def publish(source, target, metadata):
    fd, name = tempfile.mkstemp(prefix='.qh-push-', dir=str(target.parent))
    os.close(fd)
    temp = Path(name)
    try:
        shutil.copyfile(str(source), str(temp))
        os.chmod(str(temp), metadata['mode'])
        os.chown(str(temp), metadata['uid'], metadata['gid'])
        os.replace(str(temp), str(target))
    finally:
        try:
            temp.unlink()
        except FileNotFoundError:
            pass

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['install', 'rollback'])
    parser.add_argument('--root', default='/home/quickcom/public_html')
    parser.add_argument('--php', default='php')
    parser.add_argument('--backup', default='')
    parser.add_argument('--backup-root', default='/root/quickhelp-mobile-backups')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    live = root / 'mobile'
    if not live.is_dir():
        raise RuntimeError('Install mobile auth first; mobile directory is missing.')
    if live.is_symlink() or any((live / name).is_symlink() for name in FILES):
        raise RuntimeError('Mobile payload paths must be regular files/directories.')
    if args.action == 'install':
        source = Path(__file__).resolve().parents[1] / 'server/mobile'
        for name in FILES:
            if not (source / name).is_file() or not (live / name).is_file():
                raise RuntimeError('Missing update source or live file: ' + name)
        for name in ('api.php', 'index.php'):
            subprocess.run([args.php, '-l', str(source / name)], check=True)
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        backup = Path(args.backup_root).resolve() / ('onesignal-signup-' + stamp)
        backup.mkdir(mode=0o700, parents=True)
        records = {}
        for name in FILES:
            current = live / name
            stat = current.stat()
            shutil.copy2(str(current), str(backup / name))
            records[name] = {'before': sha(current), 'after': sha(source / name),
                             'uid': stat.st_uid, 'gid': stat.st_gid,
                             'mode': stat.st_mode & 0o7777}
            if sha(backup / name) != records[name]['before']:
                raise RuntimeError('Backup verification failed: ' + name)
        (backup / 'manifest.json').write_text(json.dumps({'root': str(root), 'files': records}, indent=2))
        try:
            for name in FILES:
                publish(source / name, live / name, records[name])
                if sha(live / name) != records[name]['after']:
                    raise RuntimeError('Installed file verification failed: ' + name)
        except Exception:
            for name in FILES:
                publish(backup / name, live / name, records[name])
            print('Update failed; all three prior files were restored.', file=sys.stderr)
            raise
        print('OneSignal signup server update installed.')
        print('Backup: ' + str(backup))
        print('Rollback: python3 scripts/update-mobile-push.py rollback --root ' + str(root) + ' --backup ' + str(backup))
    else:
        if not args.backup:
            raise RuntimeError('Pass the exact printed backup path with --backup.')
        backup = Path(args.backup).resolve()
        manifest = json.loads((backup / 'manifest.json').read_text())
        if manifest['root'] != str(root) or set(manifest['files']) != set(FILES):
            raise RuntimeError('Backup does not match this mobile installation.')
        records = manifest['files']
        for name in FILES:
            if sha(backup / name) != records[name]['before']:
                raise RuntimeError('Backup checksum mismatch: ' + name)
            if sha(live / name) not in (records[name]['before'], records[name]['after']):
                raise RuntimeError('Newer live edits detected; review before rollback: ' + name)
        for name in FILES:
            publish(backup / name, live / name, records[name])
            if sha(live / name) != records[name]['before']:
                raise RuntimeError('Restoration verification failed: ' + name)
        print('Previous mobile push files restored from ' + str(backup))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('FAILED: ' + str(error), file=sys.stderr)
        sys.exit(1)
