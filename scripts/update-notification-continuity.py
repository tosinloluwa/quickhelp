#!/usr/bin/env python3
"""Preserve verified OneSignal identities, legacy phone targeting and notification clicks.
Updates existing sender code in place without reading credentials into this package.
Python 3.6+, with verified backups and explicit rollback.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

MOBILE = ('core.php', 'api.php', 'app.js', 'index.php', 'enter.php', 'notifications.php')
TARGETS = tuple('mobile/' + name for name in MOBILE) + ('send-personal-notification.php', 'broadcaster.php')
MARKER = '// QHA_NOTIFICATION_CONTINUITY_V2'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_locks(root):
    tool = shutil.which('lsattr')
    if not tool:
        return
    paths = [root, root / 'mobile'] + [root / relative for relative in TARGETS if (root / relative).exists()]
    result = subprocess.run([tool, '-d'] + [str(path) for path in paths], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    if result.returncode:
        raise RuntimeError('Could not check target inode flags; no website files changed.')
    locked = []
    for line in result.stdout.splitlines():
        parts = line.split(None, 1)
        if len(parts) == 2 and ('i' in parts[0] or 'a' in parts[0]):
            locked.append(parts[1])
    if locked:
        raise RuntimeError('Immutable/append-only update targets: ' + ', '.join(locked) + '. No website files changed; retain the flags before releasing those specific locks.')

def attach_helper(text):
    if not text.lstrip().startswith('<?php'):
        raise RuntimeError('Expected a PHP opening tag in the sender.')
    return text.replace('<?php', "<?php\n" + MARKER + "\nrequire_once __DIR__.'/mobile/core.php';", 1)

def patch_personal(text):
    if MARKER in text:
        return text
    replacement = """try {
    $externalIds = qha_notification_aliases($targetPhone);
    $cleanPhone = $externalIds[0];
    $externalId = $externalIds[0];
} catch (QHAMobileError $error) {
    http_response_code(400);
    echo json_encode(['error' => 'Enter a valid Nigerian recipient phone number.']);
    exit;
}"""
    text, count = re.subn(r'\$externalId\s*=\s*\$targetPhone\s*;', lambda match: replacement, text)
    if count != 1:
        raise RuntimeError('Unexpected personal notification identity block; no files changed.')
    text, count = re.subn(r"(['\"]external_id['\"]\s*=>\s*)\[\s*\$externalId\s*\]", lambda match: match.group(1) + '$externalIds', text)
    if count != 1:
        raise RuntimeError('Unexpected personal notification target payload; no files changed.')
    text = text.replace('// Use original phone as external_id (consistent with save-device.php)', '// Target verified international identities and legacy phone aliases.')
    return attach_helper(text)

def patch_broadcaster(text):
    if MARKER in text:
        return text
    start = text.find('$targetPhone = preg_replace(')
    last = '$dbPhone = $targetPhone;'
    end = text.find(last, start)
    if start < 0 or end < 0:
        raise RuntimeError('Unexpected broadcaster recipient block; no files changed.')
    original = text[start:end]
    if '(phone_number + 0)' not in original or 'LIMIT 1' not in original:
        raise RuntimeError('Broadcaster lookup differs from reviewed code; no files changed.')
    replacement = """try {
                $targetPhone = qha_phone((string)($_POST['phone'] ?? ''));
            } catch (QHAMobileError $error) {
                $targetPhone = '';
            }
            if ($targetPhone !== '') {
                $localPhone = '0' . substr($targetPhone, 3);
                $deviceLookup = mysqli_prepare($conn, "SELECT DISTINCT player_id FROM user_devices WHERE (phone_number + 0) IN ((? + 0), (? + 0)) AND player_id IS NOT NULL AND player_id != ''");
                if ($deviceLookup) {
                    mysqli_stmt_bind_param($deviceLookup, 'ss', $targetPhone, $localPhone);
                    mysqli_stmt_execute($deviceLookup);
                    $deviceRows = mysqli_stmt_get_result($deviceLookup);
                    while ($deviceRows && ($row = mysqli_fetch_assoc($deviceRows))) {
                        $playerIds[] = $row['player_id'];
                    }
                    mysqli_stmt_close($deviceLookup);
                }
            }
            $dbPhone = $targetPhone;"""
    text = text[:start] + replacement + text[end + len(last):]
    text = text.replace('SELECT player_id FROM user_devices WHERE', 'SELECT DISTINCT player_id FROM user_devices WHERE')
    text = re.sub(r'(CURLOPT_SSL_VERIFYPEER\s*=>\s*)false', r'\1true', text)
    return attach_helper(text)

def publish(source, target, record):
    fd, temporary = tempfile.mkstemp(prefix='.qh-notification-', dir=str(target.parent))
    os.close(fd)
    path = Path(temporary)
    try:
        shutil.copyfile(str(source), str(path))
        os.chmod(str(path), record['mode'])
        os.chown(str(path), record['uid'], record['gid'])
        os.replace(str(path), str(target))
    finally:
        try:
            path.unlink()
        except FileNotFoundError:
            pass

def restore(backup, root, records):
    # Restore callers before removing helper functions or the new inbox page.
    order = ('send-personal-notification.php', 'broadcaster.php', 'mobile/api.php',
             'mobile/app.js', 'mobile/index.php', 'mobile/enter.php',
             'mobile/notifications.php', 'mobile/core.php')
    for relative in order:
        record = records[relative]
        target = root / relative
        if record['present']:
            publish(backup / relative, target, record)
            if sha(target) != record['before']:
                raise RuntimeError('Restoration checksum mismatch: ' + relative)
        else:
            try:
                target.unlink()
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
    if not (root / 'mobile').is_dir() or (root / 'mobile').is_symlink():
        raise RuntimeError('Expected an existing, regular mobile auth directory.')
    if any((root / relative).is_symlink() for relative in TARGETS):
        raise RuntimeError('Update targets must not be symbolic links.')
    check_locks(root)
    if args.action == 'rollback':
        if not args.backup:
            raise RuntimeError('Pass the exact installation backup path with --backup.')
        backup = Path(args.backup).resolve()
        manifest = json.loads((backup / 'manifest.json').read_text())
        if manifest['root'] != str(root) or set(manifest['files']) != set(TARGETS):
            raise RuntimeError('Backup does not match this installation.')
        records = manifest['files']
        for relative in TARGETS:
            record = records[relative]
            if record['present'] and sha(backup / relative) != record['before']:
                raise RuntimeError('Backup checksum mismatch: ' + relative)
            target = root / relative
            if target.exists() and sha(target) not in (record['before'], record['after']):
                raise RuntimeError('Newer edits detected; review before rollback: ' + relative)
        restore(backup, root, records)
        print('Notification continuity files restored from ' + str(backup))
        print('Remote OneSignal users/identities remain on OneSignal; this restores website files only.')
        return
    source = Path(__file__).resolve().parents[1] / 'server/mobile'
    with tempfile.TemporaryDirectory(prefix='qh-notification-stage-') as temporary:
        stage = Path(temporary)
        for name in MOBILE:
            relative = 'mobile/' + name
            if not (source / name).is_file():
                raise RuntimeError('Release file missing: ' + name)
            if name != 'notifications.php' and not (root / relative).is_file():
                raise RuntimeError('Live auth file missing: ' + relative)
            (stage / 'mobile').mkdir(exist_ok=True)
            shutil.copy2(str(source / name), str(stage / relative))
        for name, transform in [('send-personal-notification.php', patch_personal), ('broadcaster.php', patch_broadcaster)]:
            current = root / name
            if not current.is_file():
                raise RuntimeError('Live notification sender missing: ' + name)
            (stage / name).write_text(transform(current.read_text()))
        # Validate every staged PHP file before backing up or changing live code.
        for relative in TARGETS:
            if relative.endswith('.php'):
                lint = subprocess.run([args.php, '-l', str(stage / relative)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
                if lint.returncode:
                    raise RuntimeError('PHP syntax check failed for ' + relative + '; no files changed.')
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        backup = Path(args.backup_root).resolve() / ('notification-continuity-' + stamp)
        backup.mkdir(mode=0o700, parents=True)
        records = {}
        for relative in TARGETS:
            current = root / relative
            present = current.is_file()
            stat = current.stat() if present else current.parent.stat()
            record = {'present': present, 'before': sha(current) if present else None,
                      'after': sha(stage / relative), 'uid': stat.st_uid, 'gid': stat.st_gid,
                      'mode': stat.st_mode & 0o7777 if present else 0o644}
            if present:
                saved = backup / relative
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(current), str(saved))
                if sha(saved) != record['before']:
                    raise RuntimeError('Backup verification failed: ' + relative)
            records[relative] = record
        (backup / 'manifest.json').write_text(json.dumps({'root': str(root), 'files': records}, indent=2))
        try:
            for relative in TARGETS:
                publish(stage / relative, root / relative, records[relative])
                if sha(root / relative) != records[relative]['after']:
                    raise RuntimeError('Update checksum mismatch: ' + relative)
        except Exception:
            restore(backup, root, records)
            print('Update failed; previous website files restored.', file=sys.stderr)
            raise
        print('Notification continuity server update installed. Existing sender credentials retained.')
        print('Backup: ' + str(backup))
        print('Rollback: python3 scripts/update-notification-continuity.py rollback --root ' + str(root) + ' --backup ' + str(backup))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('FAILED: ' + str(error), file=sys.stderr)
        sys.exit(1)
