# QuickHelp OneSignal signup continuity

This update restores the original mobile signup's OneSignal `phone_number` tag after successful server-side phone verification. It retains the existing portal `user_devices` subscription mapping and fixes duplicate insertion on repeated unchanged registrations. It does not change the OneSignal app ID or use OneSignal for SMS. SMS verification stays with Termii and the existing private configuration.

## Apply the commits to your Windows repository

Extract the ZIP to Downloads. From Command Prompt:

```cmd
cd /d C:\Users\HP\Documents\quickhelp\app_2026\quickhelp
git status --short --branch
```

With a clean working tree on `feature/mobile-auth-1.5`:

```cmd
git am "%USERPROFILE%\Downloads\QuickHelp-OneSignal-Signup-Fix\QuickHelp-OneSignal-Signup-Fix.patch"
git push origin feature/mobile-auth-1.5
```

The patch includes the Python 3.6 compatibility repair previously applied manually on the server. If a patch fails, stop and retain its error output. `git am --abort` returns an incomplete application to its starting point.

## Update the server

Upload and extract this ZIP under `/root`, then run:

```bash
cd /root/QuickHelp-OneSignal-Signup-Fix
python3 scripts/update-mobile-push.py install --root /home/quickcom/public_html
```

Only `mobile/api.php`, `mobile/app.js`, and `mobile/index.php` are replaced. The updater checks PHP syntax before writing, makes verified backups, retains each live file's owner and permissions, and restores the prior files if an update fails. It writes within the existing mobile directory, so `/home/quickcom` can retain its existing immutable flag. No configuration file or database migration is part of this update.

For rollback, use the exact backup path printed by installation:

```bash
python3 scripts/update-mobile-push.py rollback --root /home/quickcom/public_html --backup /root/quickhelp-mobile-backups/onesignal-signup-TIMESTAMP
```

Rollback checks backup hashes and refuses to overwrite later edits. The phone tag added to OneSignal by a running APK is remote user metadata; rolling back server files does not erase existing OneSignal tags.

## Android check

Build/install the updated APK using the existing signing setup. Complete signup and phone verification inside it, and allow notifications when you select Enable notifications. In OneSignal, inspect the device's push subscription and confirm the `phone_number` tag equals the verified phone in international digits (`234...`). Confirm the same subscription is mapped in the portal `user_devices` table. Repeat a verified login and confirm the existing row is reused. Signing out from the mobile auth page clears the tag and unlinks its phone mapping.

Browser and terminal tests cannot exercise the native OneSignal SDK. Local checks covered the production Angular build, PHP static syntax, simulated Cordova/hosted-page events, delayed/replaced subscription IDs, failed-registration retry, and verified-phone gating. The server update/rollback was checked against temporary files using a PHP stub; live MySQL and physical Android/OneSignal delivery still need testing.
