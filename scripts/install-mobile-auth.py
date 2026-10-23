#!/usr/bin/env python3
"""Back up and install QuickHelp mobile auth PHP beside the live site.
Run on the server as root. Does not populate credentials or publish files remotely.
"""
from pathlib import Path
import argparse, datetime, hashlib, os, shutil, subprocess, sys, tarfile

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def atomic_copy(src,dst):
    dst.parent.mkdir(parents=True,exist_ok=True)
    tmp=dst.with_name(dst.name+'.qh-new')
    shutil.copy2(src,tmp);os.replace(tmp,dst)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('action',choices=['install','rollback']);ap.add_argument('--root',required=True,help='QuickHelp public_html directory');ap.add_argument('--php',default='php');ap.add_argument('--backup',default='');ap.add_argument('--backup-root',default='/root/quickhelp-mobile-backups');args=ap.parse_args()
    root=Path(args.root).resolve();source=Path(__file__).resolve().parents[1]/'server/mobile';backuproot=Path(args.backup_root)
    if not (root/'user/geruz/db.php').is_file():raise SystemExit('Could not find user/geruz/db.php; stop and check --root.')
    if args.action=='install':
        check="$v=PHP_VERSION_ID; if($v<70400 || !extension_loaded('mysqli') || !function_exists('mysqli_stmt_get_result') || !function_exists('curl_init') || !function_exists('session_start')){fwrite(STDERR,'Use the site PHP CLI (7.4+) with mysqli/mysqlnd, curl and sessions.\\n');exit(2);}"
        subprocess.run([args.php,'-r',check],check=True)
        expected=['index.php','api.php','core.php','passwords.php','google-callback.php','enter.php','app.js','styles.css','schema.sql','.htaccess','config.example.php','logo.png','google.png']
        missing=[f for f in expected if not (source/f).is_file()]
        if missing:raise SystemExit('Incomplete release source: '+', '.join(missing))
        stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');backup=backuproot/f'quickhelp-mobile-{stamp}'
        targets=[root/'mobile',root/'user/mobile-passwords.php',root/'user/index.php',root/'user/login_f21.php']
        backup.mkdir(parents=True,mode=0o700)
        for target in targets:
            if target.is_dir():
                shutil.copytree(target,backup/'mobile',symlinks=True)
            elif target.exists():
                dest=backup/target.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
        config_path=root.parent/'quickhelp-mobile-config.php'
        if config_path.exists():
            shutil.copy2(config_path,backup/'quickhelp-mobile-config.php')
        else:
            (backup/'CONFIG_WAS_ABSENT').write_text('This installer created quickhelp-mobile-config.php.\n')
        # Publish the whole new web app atomically after all backups are complete.
        staging=root/'mobile.qh-staging'
        if staging.exists():shutil.rmtree(staging)
        shutil.copytree(source,staging)
        live=root/'mobile';old=root/'mobile.qh-old'
        if old.exists():shutil.rmtree(old)
        if live.exists():os.replace(live,old)
        os.replace(staging,live)
        shutil.copy2(source/'passwords.php',root/'user/mobile-passwords.php')
        try:
            subprocess.run([sys.executable,str(Path(__file__).with_name('patch-website-login.py')),'install','--root',str(root),'--backup',str(backup)],check=True)
        except Exception:
            if live.exists():shutil.rmtree(live)
            if old.exists():os.replace(old,live)
            if (backup/'user/mobile-passwords.php').exists():shutil.copy2(backup/'user/mobile-passwords.php',root/'user/mobile-passwords.php')
            raise
        oldconfig=root.parent/'quickhelp-mobile-config.php'
        if not oldconfig.exists():
            config=source/'config.example.php';body=config.read_text().replace("'/home/quickcom/public_html/user/geruz/db.php'",repr(str(root/'user/geruz/db.php')))
            oldconfig.write_text(body);oldconfig.chmod(0o600);os.chown(oldconfig,root.stat().st_uid,root.stat().st_gid)
        try:
            os.chmod(oldconfig,0o600)
            oldconfig.write_text(oldconfig.read_text()+"\n// Installed by QuickHelp Android 1.5.0. Configure Termii and Google values before enabling sign-in.\n") if '// Installed by QuickHelp Android' not in oldconfig.read_text() else None
        except OSError:pass
        # Migration runs only against the existing portal connection loaded by geruz/db.php.
        runner=root/'.qh-mobile-migrate.php'
        runner.write_text("<?php require "+repr(str(root/'user/geruz/db.php'))+"; if(!isset($con)||!($con instanceof mysqli)){fwrite(STDERR,'Portal database unavailable\\n');exit(2);} mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT); $sql=file_get_contents("+repr(str(live/'schema.sql'))+"); foreach(array_filter(array_map('trim',explode(';',$sql))) as $q){$con->query($q);} echo 'Mobile auth tables installed in portal DB.\\n';")
        try:subprocess.run([args.php,str(runner)],check=True)
        except Exception:
            print(f'Files installed, database migration failed. Roll back with backup {backup}.',file=sys.stderr);raise
        finally:runner.unlink(missing_ok=True)
        if old.exists():shutil.rmtree(old)
        print(f'Installed mobile auth. Backup: {backup}')
        print(f'Config: {oldconfig} (mode 600; fill in Termii and Google credentials privately).')
    else:
        backup=Path(args.backup).resolve() if args.backup else None
        candidates=sorted(backuproot.glob('quickhelp-mobile-*'),key=lambda p:p.name,reverse=True)
        if backup is None and candidates:backup=candidates[0]
        if backup is None or not backup.is_dir():raise SystemExit('Specify a valid install backup with --backup.')
        print(f'Rolling back from {backup}')
        live=root/'mobile'
        if live.exists():shutil.rmtree(live)
        if (backup/'mobile').is_dir():shutil.copytree(backup/'mobile',live)
        config_path=root.parent/'quickhelp-mobile-config.php'
        saved_config=backup/'quickhelp-mobile-config.php'
        if saved_config.is_file():
            shutil.copy2(saved_config,config_path)
            try:os.chown(config_path,root.stat().st_uid,root.stat().st_gid)
            except OSError:pass
        elif (backup/'CONFIG_WAS_ABSENT').is_file():
            config_path.unlink(missing_ok=True)
        for name in ['user/index.php','user/login_f21.php','user/mobile-passwords.php']:
            saved=backup/name;target=root/name
            if saved.exists():target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(saved,target)
            elif name.endswith('mobile-passwords.php'):target.unlink(missing_ok=True)
        subprocess.run([sys.executable,str(Path(__file__).with_name('patch-website-login.py')),'rollback','--root',str(root),'--backup',str(backup)],check=False)
        print('Files restored. The additive qha_* database tables remain in place for audit and safe recovery.')
if __name__=='__main__':main()
