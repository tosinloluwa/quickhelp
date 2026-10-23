# QuickHelp Mobile Auth: server install and rollback

These terminal scripts install the website side of the Android 1.5 signup flow. Run them on the QuickHelp Linux server from the extracted release directory. The install makes a timestamped backup before changing website files.

## Install

For the current QuickHelp hosting layout, run as root:

```bash
cd /root/QuickHelp-Android-1.5.0
bash install-mobile-auth.sh /home/quickcom/public_html
```

The installer checks the PHP CLI version and required extensions, checks the expected website login files, copies the mobile pages, patches website login compatibility, and adds the `qha_*` tables to the existing portal database loaded by `user/geruz/db.php`. It prints the backup directory and the private configuration file path when complete. Save the printed backup path for rollback.

If the host uses a specific PHP CLI binary, pass it after the document root:

```bash
bash install-mobile-auth.sh /home/quickcom/public_html --php /usr/bin/php74
```

Configure the generated `quickhelp-mobile-config.php` with the website's approved Termii sender settings and Google Web OAuth credentials before testing signup. Keep this file outside `public_html` and restrict it to the PHP account.

## Roll back

Copy the exact backup path printed by installation and run:

```bash
bash rollback-mobile-auth.sh /home/quickcom/public_html /root/quickhelp-mobile-backups/quickhelp-mobile-YYYYMMDD-HHMMSS
```

Rollback restores the previous mobile pages, website login files, password helper, and any configuration file that existed before installation. If installation created the configuration file, rollback removes it. The additive `qha_*` database tables are intentionally left in place; they do not overwrite existing user or payment data.

## Before running

- Upload and extract the release bundle on the server.
- Confirm `/home/quickcom/public_html/user/geruz/db.php`, `user/index.php`, and `user/login_f21.php` exist.
- Have a recoverable hosting/database backup and keep the installer output with the timestamped backup path.
- Do not paste Termii or Google secrets into terminal history or send them in chat.

The scripts do not test provider delivery. After configuring credentials, test Google sign-in and Termii SMS verification with a real device and phone number.
