<?php
// Install outside public_html as /home/quickcom/quickhelp-mobile-config.php.
// This file is never served by the website or included in the Android app.
return [
    'portal_db' => '/home/quickcom/public_html/user/geruz/db.php',
    'origin' => 'https://quickhelp.com.ng',
    'google_client_id' => '',
    'google_client_secret' => '',
    'google_redirect_uri' => 'https://quickhelp.com.ng/mobile/google-callback.php',
    'termii_base_url' => '', // Copy the account-specific HTTPS base URL from Termii.
    'termii_api_key' => '',
    'termii_sender_id' => '', // Approved sender ID.
    'termii_channel' => 'dnd',
    'sms_daily_limit' => 100, // Site-wide ceiling; adjust to your budget.
];
