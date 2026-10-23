# QuickHelp Android 1.5.0 signup and login update

This release gives the Android app a QuickHelp themed welcome screen, Google first sign in, email and password login, Termii SMS phone verification, and a cancellable loading state. The hosted first party pages share QuickHelp's existing `users` table and PHP session. Signup creates a Basic account. A user cannot open chat until the phone number is verified. Google accounts are matched by verified Google identity and email. The app never stores a password, session flag, phone number, OTP or auth token in its own local storage.

The mobile project is Ionic/Angular/Cordova. App ID stays `com.quickhelpnigeria2024.app`; version is `1.5.0` and Android code is `10500`. Existing Play Store signing keys are not included in this patch archive.

## What the website administrator must set up

The installer uploads the self contained `server/mobile/` pages under `public_html/mobile`, adds `user/mobile-passwords.php`, creates four additive `qha_*` tables in **the existing `quickcom_quick_portal` account database**, and patches the two supplied website login files so they accept the modern app password hashes while retaining legacy MD5 compatibility. It makes dated copies first. It does not touch QuickCommerce/Qknows databases, balances, payment records, or existing password values.

Run the installer on the web server from the extracted release root:

```bash
python3 scripts/install-mobile-auth.py install --root /home/quickcom/public_html
```

The script reports the backup path. Configure `/home/quickcom/quickhelp-mobile-config.php` privately. Keep it outside `public_html`, owned by the QuickHelp PHP account, mode `600`. Set:

- `portal_db` to this site's existing `user/geruz/db.php`.
- Termii account HTTPS base URL, API token, approved sender ID and channel. The API key stays in this server file. The initial SMS spending ceiling is 100 requests per 24 hours.
- Google **Web application** client ID and secret, with redirect URI exactly `https://quickhelp.com.ng/mobile/google-callback.php` registered at Google. The sign-in uses a system browser, server code exchange, PKCE, state, nonce and Google's token validation endpoint.

The PHP site needs PHP 7.4 or newer with `mysqli`/mysqlnd, `curl`, sessions and HTTPS enabled. Confirm the PHP-FPM account can read the config and write its normal session directory. Configure provider values before testing the live flows. A missing provider setting displays email login or a clear unavailable message; it never fakes success.

Rollback the website files from the printed backup path:

```bash
python3 scripts/install-mobile-auth.py rollback --root /home/quickcom/public_html --backup /root/quickhelp-mobile-backups/quickhelp-mobile-YYYYMMDD-HHMMSS
```

Rollback restores the prior website login and mobile files. Empty `qha_*` tables are additive and left in place to preserve audit safety; remove them only after confirming there are no accounts or active sessions depending on this installation.

## Build the Android app on Windows

Overlay the `android-app/` files in this patch onto the existing QuickHelp project, preserving its local signing key outside the patch. In PowerShell:

```powershell
Set-Location 'C:\path\to\quickhelp'
npm ci --legacy-peer-deps
npx cordova platform add android@14.0.1
npx cordova prepare android
npx cordova build android --release
```

Use the existing private signing configuration for a Play Store release. Install the resulting APK on a real Android phone to check keyboard resizing, system-browser Google sign in and return, Termii SMS delivery and entry, returning website sessions, SOS sign in, payment redirects and OneSignal notifications. A local web build cannot validate those device/provider flows.

## Review checks

The production Angular bundle built successfully with the locked project dependencies. The PHP endpoints passed static parsing with PHP 7.4 grammar, and the UI smoke test covered Google handoff and email signup through phone verification. Installer/rollback tests used recovered login-file copies and a stub PHP executable, so they checked file backup/restoration, not a real database migration. Live PHP/MySQL, Google, Termii and Android device flows still need testing against the configured server and a phone; no live website or provider credentials are present here.
