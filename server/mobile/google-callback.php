<?php
require __DIR__.'/core.php';
qha_start();$ok=false;$message='Google sign-in could not be completed. Return to QuickHelp and try again.';$flow=null;
try {
    $state=$_GET['state']??'';
    if (!is_string($state)||!preg_match('/^[a-f0-9]{64}$/',$state)) qha_fail('Invalid sign-in request.');
    $flow=qha_one('SELECT * FROM qha_oauth_flows WHERE state_hash=?',[hash('sha256',$state)]);
    if ($flow && !empty($flow['referrer'])) $_SESSION['ref_token']=$flow['referrer'];
    if (!$flow||$flow['expires_at']<time()||$flow['status']!=='pending') qha_fail('This sign-in request has expired.');
    $s=qha_query('UPDATE qha_oauth_flows SET status="processing" WHERE id=? AND status="pending"',[$flow['id']]);
    if ($s->affected_rows!==1) qha_fail('This sign-in request has already been used.');
    if (!empty($_GET['error'])) qha_fail('Google sign-in was cancelled.');
    $code=$_GET['code']??'';if(!is_string($code)||!$code||strlen($code)>4096)qha_fail('Missing sign-in result.');
    $c=qha_config();
    $tokens=qha_http('https://oauth2.googleapis.com/token',http_build_query(['code'=>$code,'client_id'=>$c['google_client_id'],
        'client_secret'=>$c['google_client_secret'],'redirect_uri'=>$c['google_redirect_uri'],'grant_type'=>'authorization_code','code_verifier'=>$flow['verifier']]),['Content-Type: application/x-www-form-urlencoded']);
    // Ask Google's token validation endpoint to verify signature, audience, expiry and nonce.
    if (empty($tokens['id_token']))qha_fail('Google did not provide a sign-in token.');
    $profile=qha_http('https://oauth2.googleapis.com/tokeninfo?id_token='.rawurlencode($tokens['id_token']));
    $subject=$profile['sub']??'';$email=strtolower($profile['email']??'');
    $issuer=$profile['iss']??'';$verified=$profile['email_verified']??false;
    if (($verified!==true && $verified!=='true') || !hash_equals((string)$c['google_client_id'],(string)($profile['aud']??'')) ||
        !hash_equals((string)$flow['nonce'],(string)($profile['nonce']??'')) || (int)($profile['exp']??0)<=time() ||
        !in_array($issuer,['accounts.google.com','https://accounts.google.com'],true) || !is_string($subject)||strlen($subject)>255||!$subject||!filter_var($email,FILTER_VALIDATE_EMAIL))
        qha_fail('Google must provide a valid, verified sign-in.');
    $db=qha_db();$db->begin_transaction();
    try {
        $link=qha_one('SELECT user_id FROM qha_google_accounts WHERE subject=? FOR UPDATE',[$subject]);
        if ($link) {$uid=(int)$link['user_id'];if(!qha_one('SELECT id FROM users WHERE id=?',[$uid]))qha_fail('This account is no longer available.');}
        else {
            $u=qha_one('SELECT id FROM users WHERE email=? FOR UPDATE',[$email]);
            if ($u) {
                // Google is not authoritative for arbitrary third-party email addresses.
                if (!preg_match('/@(gmail\.com|googlemail\.com)$/i',$email) && empty($profile['hd'])) qha_fail('Please use email and password for your existing QuickHelp account.');
                $uid=(int)$u['id'];
            } else {
                $first=substr(trim($profile['given_name']??'QuickHelp'),0,191);$last=substr(trim($profile['family_name']??'User'),0,191);
                $uid=qha_create_user($first?:'QuickHelp',$last?:'User',$email,password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT),true);
            }
            qha_query('INSERT INTO qha_google_accounts (subject,user_id) VALUES (?,?)',[$subject,$uid]);
        }
        qha_query('UPDATE qha_oauth_flows SET user_id=?,status="complete" WHERE id=?',[$uid,$flow['id']]);$db->commit();
    } catch(Throwable $e){$db->rollback();throw $e;}
    $ok=true;$message='Google sign-in is complete. Return to the QuickHelp app to continue.';
} catch(Throwable $e) {
    $message=$e instanceof QHAMobileError?$e->getMessage():$message;
    if ($flow) {try{qha_query('UPDATE qha_oauth_flows SET status="failed",error=? WHERE id=?',[$message,$flow['id']]);}catch(Throwable $ignored){}}
}
?>
<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>QuickHelp sign-in</title><link rel="stylesheet" href="styles.css"></head>
<body><main class="app"><img class="logo" src="logo.png" alt="QuickHelp"><h1><?= $ok?'You’re signed in.':'Sign-in not completed' ?></h1><p><?=htmlspecialchars($message,ENT_QUOTES,'UTF-8')?></p><p>You can close this browser tab.</p></main></body></html>
