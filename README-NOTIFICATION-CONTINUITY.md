# QuickHelp notification identity and click continuity

The recovered live notification sender uses phone-based External IDs, while the broadcaster looks up device subscriptions in `user_devices`. This update restores the complete mobile flow after phone verification and keeps both targeting methods compatible.

## Result

- After the server verifies the phone and acknowledges the subscription mapping, Android calls `OneSignal.login(verifiedPhone)` and sets the `phone_number` tag. The canonical value is international digits (`234...`). The OneSignal App ID remains unchanged.
- The personalized sender targets canonical, local (`080...`), national (`80...`), plus-prefixed and original caller aliases. This preserves legacy users while the new app uses consistent identities. Existing REST API keys remain in the server's existing sender files. No REST API key is included in the Android app.
- The broadcaster matches national and international database phone formats and sends to all matched device subscriptions. Existing app-wide broadcast behaviour is retained. Its HTTPS certificate verification is enabled.
- Notification ID, title, body and type survive a native click and login/verification. They pass through authenticated POST fields rather than URL parameters. Existing explicit notification-page routing remains; other clicks continue to chat. The welcome screen also has a Notifications button.
- `/mobile/notifications.php` shows the signed-in user's `user_notifications` records and GLOBAL announcements, plus clicked messages cached for that account. It renders content as text. Read markers are browser-local per account. Existing `/notifications.php` and `/fetch-notifications.php` remain available for legacy app clients; the latter's app-wide history is not used by the new inbox.
- Sign-out detaches the device's OneSignal user context and clears its website phone mapping. Existing remote user profiles retain their tags for other devices.

## Apply the Windows repository patch

Extract this ZIP into Downloads. In Command Prompt:

```cmd
cd /d C:\Users\HP\Documents\quickhelp\app_2026\quickhelp
git status --short --branch
```

The working tree must be clean on `feature/mobile-auth-1.5`. This patch starts from the earlier OneSignal Signup Fix, which matches the online branch at commit `200f3895` when this update was prepared:

```cmd
git am "%USERPROFILE%\Downloads\QuickHelp-Notification-Continuity\QuickHelp-Notification-Continuity.patch"
```

If your local checkout has not received the earlier OneSignal Signup Fix, stop and synchronize that branch first. If patching fails, stop and retain the output; `git am --abort` returns an incomplete patch application to its starting point.

Then publish and rebuild the Android app with the existing signing configuration:

```cmd
git push origin feature/mobile-auth-1.5
```

## Server installation

Upload the ZIP to `/root`, then:

```bash
cd /root
unzip -n QuickHelp-Notification-Continuity.zip
cd /root/QuickHelp-Notification-Continuity
python3 scripts/update-notification-continuity.py install --root /home/quickcom/public_html
```

The updater supports Python 3.6+, checks the two sender sections against the reviewed live code, and lints every staged PHP file before publishing. It checks immutable/append-only flags on actual update targets before publishing. It retains the original sender credentials, creates checksum-verified backups and preserves file ownership/mode. On an update failure it restores prior files. It updates six mobile files (including one new inbox page) and two existing sender files. It does not run a migration or alter private Termii/Google configuration. `/home/quickcom` may keep its immutable flag because all writes happen within existing public_html directories.

Use the exact backup path printed on success for rollback:

```bash
python3 scripts/update-notification-continuity.py rollback --root /home/quickcom/public_html --backup /root/quickhelp-mobile-backups/notification-continuity-TIMESTAMP
```

Rollback restores the website files and removes the inbox page if it was new. It checks backup hashes and refuses to overwrite newer live edits. Remote OneSignal users, aliases and tags are not deleted by a file rollback. A complete behavioural rollback also requires the previous APK; keep its signed release available.

## Verification limits

Local checks use mocked Cordova/OneSignal events and PHP syntax parsing. The deployment tests use a PHP stub and temporary website files with placeholder credentials, including exact restoration after simulated update failure. These checks do not prove live MySQL queries, real OneSignal identity assignment, notification delivery, or Android return behaviour. Test the rebuilt APK on a phone: verify signup, check the External ID and subscription in OneSignal, send a personal notification using both `080...` and `234...`, and test a broadcast and notification click. A terminal Termii OTP test does not register a native push subscription.
