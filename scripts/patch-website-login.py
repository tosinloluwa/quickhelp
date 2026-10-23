#!/usr/bin/env python3
"""Install/remove the shared MD5/bcrypt password verifier in QuickHelp website logins."""
from pathlib import Path
import argparse, hashlib, os, re, shutil, sys, time

BLOCK = '''    $email_raw = strtolower(trim(stripslashes((string)($_REQUEST['email'] ?? ''))));
    $email = mysqli_real_escape_string($con, $email_raw);
    $password = (string)($_REQUEST['password'] ?? '');
    $stmt = mysqli_prepare($con, "SELECT * FROM users WHERE email = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "s", $email_raw);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    $candidate = $result ? mysqli_fetch_assoc($result) : null;
    $checkname = ($candidate && qha_password_matches($password, (string)$candidate['password'], $con)) ? $candidate : null;
'''
MARK='// QHA_SHARED_PASSWORD_CHECK_V1'

def patch(path, mode, backup, root):
    raw=path.read_bytes(); text=raw.decode('utf-8-sig'); nl='\r\n' if b'\r\n' in raw else '\n'; norm=text.replace('\r\n','\n')
    if mode=='install':
        if MARK in norm: return False
        if path.name=='index.php':
            pat=re.compile(r"        \$email = stripslashes\(\$_REQUEST\['email'\]\);.*?        \$rows = mysqli_num_rows\(\$result\);",re.S)
            repl=MARK+"\n"+BLOCK+"\n        $rows = $checkname ? 1 : 0;"
        else:
            pat=re.compile(r"    \$email = mysqli_real_escape_string\(\$con, stripslashes\(\$_REQUEST\['email'\]\)\);.*?    \$checkname = mysqli_fetch_assoc\(\$result\);",re.S)
            repl=MARK+"\n"+BLOCK
        norm2,n=pat.subn(repl,norm,count=1)
        if n!=1: raise RuntimeError(f'Could not find the expected legacy password check in {path}')
        if path.name=='login_f21.php':
            old_loop="        foreach ($checkname as $key => $value) {\n            $_SESSION[$key] = $value;\n        }"
            new_loop="        $qh_ref_token = $_SESSION['ref_token'] ?? null;\n        $_SESSION = [];\n        if ($qh_ref_token !== null) $_SESSION['ref_token'] = $qh_ref_token;\n        foreach ($checkname as $key => $value) {\n            if ($key !== 'password') $_SESSION[$key] = $value;\n        }"
            if old_loop not in norm2: raise RuntimeError(f'Could not find the expected website login session setup in {path}')
            norm2=norm2.replace(old_loop,new_loop,1)
        pos=norm2.find('<?php')
        if pos<0: raise RuntimeError(f'No PHP opening tag in {path}')
        insert=pos+5
        norm2=norm2[:insert]+"\nrequire_once __DIR__.'/mobile-passwords.php';\n"+norm2[insert:]
        if backup:
            dest=backup/path.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,dest)
        path.write_text(norm2.replace('\n',nl),encoding='utf-8')
        return True
    if MARK not in norm: return False
    if not backup: raise RuntimeError('Rollback needs the backup directory.')
    original=backup/path.relative_to(root)
    if not original.is_file(): raise RuntimeError(f'Missing backup: {original}')
    expected=hashlib.sha256(original.read_bytes()).hexdigest()
    # Restore the exact pre-install file saved by this patch.
    shutil.copy2(original,path)
    return expected is not None

def main():
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['install','rollback']);ap.add_argument('--root',required=True);ap.add_argument('--backup',required=True);a=ap.parse_args()
    root=Path(a.root).resolve();backup=Path(a.backup).resolve()
    paths=[root/'user/index.php',root/'user/login_f21.php']
    for path in paths:
        if not path.is_file(): raise SystemExit(f'Required login file is missing: {path}')
    # Verify all source patterns before changing either file.
    if a.mode=='install':
        for path in paths:
            text=path.read_text(errors='replace')
            if MARK not in text and ('password=\'" . md5($password) . "\'' not in text and 'password=\'" . md5($password) . "\'' not in text):
                raise SystemExit(f'Unexpected login code; review before patching: {path}')
        backup.mkdir(mode=0o700,parents=True,exist_ok=True)
        for path in paths:
            if MARK not in path.read_text(errors='replace'):
                dest=backup/path.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,dest)
        for path in paths: patch(path,'install',None,root)
    else:
        for path in paths:
            if MARK in path.read_text(errors='replace'):
                original=backup/path.relative_to(root)
                if not original.is_file():raise SystemExit(f'Missing rollback copy: {original}')
        for path in paths:patch(path,'rollback',backup,root)
    print(f'Website login patch {a.mode} complete.')
if __name__=='__main__':
    try:main()
    except Exception as exc:print(f'FAILED: {exc}',file=sys.stderr);sys.exit(1)
