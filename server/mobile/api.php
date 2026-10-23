<?php
require __DIR__.'/core.php';
qha_start();header('Content-Type: application/json');
try {
    if ($_SERVER['REQUEST_METHOD']!=='POST') qha_fail('Use POST.',405);
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>16384) qha_fail('Request too large.',413);
    $b=json_decode(file_get_contents('php://input'),true);
    if (!is_array($b)) qha_fail('Invalid request.');
    if (!is_string($b['csrf']??null)||!hash_equals($_SESSION['qha_csrf'],$b['csrf'])) qha_fail('Your session has changed. Please reload.',403);
    $action=$b['action']??'';
    switch($action) {
    case 'status': $out=qha_status();break;
    case 'login':
        $email=strtolower(qha_input($b,'email'));$plain=$b['password']??'';
        if (!is_string($plain)||strlen($plain)>4096) qha_fail('Email or password is incorrect.',401);
        qha_rate('login-ip',qha_ip(),30,900);qha_rate('login-email',$email,10,900);
        $u=qha_one('SELECT * FROM users WHERE email=?',[$email]);
        if (!$u||!qha_password_matches($plain,$u['password'],qha_db())) qha_fail('Email or password is incorrect.',401);
        qha_pending($u['id']);$out=qha_status();break;
    case 'signup':
        qha_rate('signup',qha_ip(),5,3600);
        $first=qha_input($b,'first_name');$last=qha_input($b,'last_name');$email=strtolower(qha_input($b,'email'));$pass=$b['password']??'';
        if (!$first||!$last||!filter_var($email,FILTER_VALIDATE_EMAIL)) qha_fail('Enter your name and a valid email address.');
        if (!is_string($pass)||strlen($pass)<10||strlen($pass)>72) qha_fail('Use a password between 10 and 72 bytes.');
        if (qha_one('SELECT id FROM users WHERE email=? OR username=?',[$email,$email])) qha_fail('An account already uses this email. Please sign in.',409);
        $id=qha_create_user($first,$last,$email,password_hash($pass,PASSWORD_DEFAULT));
        qha_pending($id);$out=qha_status();break;
    case 'send-code':
        $u=qha_user();if (!$u) qha_fail('Sign in to continue.',401);
        $phone=qha_phone(qha_input($b,'phone',30));$id=(int)$u['id'];
        if (time()-(int)($_SESSION['qha_sms_sent_at']??0)<30) qha_fail('Please wait 30 seconds before requesting another code.',429);
        qha_rate('sms-user',(string)$id,5,3600);qha_rate('sms-phone',$phone,5,3600);
        qha_rate('sms-ip',qha_ip(),15,3600);qha_rate('sms-budget','all',max(1,(int)qha_config()['sms_daily_limit']),86400);
        qha_phone_available($phone,$id);
        $c=qha_config();
        $r=qha_termii('send',['message_type'=>'NUMERIC','pin_type'=>'NUMERIC','to'=>$phone,'from'=>$c['termii_sender_id'],
            'channel'=>$c['termii_channel'],'pin_attempts'=>3,'pin_time_to_live'=>5,'pin_length'=>6,
            'pin_placeholder'=>'< 123456 >','message_text'=>'Your QuickHelp verification code is < 123456 >. Valid for 5 minutes. Do not share this code.']);
        if (empty($r['pinId'])||!is_string($r['pinId'])) qha_fail('The code could not be sent. Please try again.',502);
        $_SESSION['qha_sms']=['pin_id'=>$r['pinId'],'phone'=>$phone,'user_id'=>$id,'expires'=>time()+300,'attempts'=>0];
        $_SESSION['qha_sms_sent_at']=time();
        $out=['state'=>'code','phone'=>$phone,'retry_after'=>30];break;
    case 'verify-code':
        $u=qha_user();$challenge=$_SESSION['qha_sms']??null;
        if (!$u||!$challenge||(int)$challenge['user_id']!==(int)$u['id']) qha_fail('Request a new code.',401);
        if (time()>=$challenge['expires']) {unset($_SESSION['qha_sms']);qha_fail('This code has expired. Request a new code.');}
        if ($challenge['attempts']>=3) qha_fail('Too many attempts. Request a new code.',429);
        $pin=qha_input($b,'code',6);if (!preg_match('/^\d{6}$/',$pin)) qha_fail('Enter the 6-digit code.');
        $_SESSION['qha_sms']['attempts']++;
        $r=qha_termii('verify',['pin_id'=>$challenge['pin_id'],'pin'=>$pin]);
        $verified=$r['verified']??false;
        if (!($verified===true || $verified==='True' || $verified==='true')) qha_fail('That code is incorrect or expired. Please try again.');
        if (isset($r['msisdn']) && qha_phone((string)$r['msisdn'])!==$challenge['phone']) qha_fail('Verification did not match your phone number.',502);
        $db=qha_db();$db->begin_transaction();
        try {
            qha_query('SELECT id FROM users WHERE id=? FOR UPDATE',[(int)$u['id']]);
            qha_phone_available($challenge['phone'],(int)$u['id']);
            qha_query('DELETE FROM qha_phone_verifications WHERE user_id=?',[(int)$u['id']]);
            qha_query('INSERT INTO qha_phone_verifications (user_id,phone,verified_at) VALUES (?,?,NOW())',[(int)$u['id'],$challenge['phone']]);
            qha_query('UPDATE users SET phone_no=?,updated_at=NOW() WHERE id=?',[$challenge['phone'],(int)$u['id']]);
            $db->commit();
        } catch(Throwable $e) {$db->rollback();throw $e;}
        unset($_SESSION['qha_sms']);$out=qha_status();$out['state']='success';break;
    case 'google-start':
        qha_rate('google',qha_ip(),15,900);$c=qha_config();
        if (!$c['google_client_id']||!$c['google_client_secret']) qha_fail('Google sign-in is not configured yet. Please use email.',503);
        if (!empty($_SESSION['qha_flow'])) qha_query('DELETE FROM qha_oauth_flows WHERE id=?',[$_SESSION['qha_flow']]);
        $id=bin2hex(random_bytes(32));$state=bin2hex(random_bytes(32));$verifier=bin2hex(random_bytes(32));$nonce=bin2hex(random_bytes(32));
        qha_query('INSERT INTO qha_oauth_flows (id,state_hash,verifier,nonce,referrer,expires_at,created_at) VALUES (?,?,?,?,?,?,NOW())',[$id,hash('sha256',$state),$verifier,$nonce,substr((string)($_SESSION['ref_token']??''),0,191),time()+300]);
        $_SESSION['qha_flow']=$id;
        $url='https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query(['client_id'=>$c['google_client_id'],'redirect_uri'=>$c['google_redirect_uri'],
            'response_type'=>'code','scope'=>'openid email profile','state'=>$state,'nonce'=>$nonce,'prompt'=>'select_account',
            'code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'='),'code_challenge_method'=>'S256']);
        // Only this session can claim the result. No bearer login credential is placed in a URL.
        $out=['url'=>$url];break;
    case 'google-poll':
        $id=$_SESSION['qha_flow']??'';$r=$id?qha_one('SELECT * FROM qha_oauth_flows WHERE id=?',[$id]):null;
        if (!$r||$r['expires_at']<time()) qha_fail('Google sign-in expired. Please try again.',410);
        if ($r['status']==='failed') qha_fail($r['error']?:'Google sign-in was not completed.');
        if ($r['status']!=='complete') {$out=['state'=>'waiting'];break;}
        qha_query('DELETE FROM qha_oauth_flows WHERE id=?',[$id]);qha_pending($r['user_id']);$out=qha_status();break;
    case 'google-cancel':
        if (!empty($_SESSION['qha_flow']))qha_query('DELETE FROM qha_oauth_flows WHERE id=?',[$_SESSION['qha_flow']]);
        unset($_SESSION['qha_flow']);$out=['state'=>'welcome'];break;
    case 'device':
        $u=qha_user();if (!$u||!qha_verified($u)) qha_fail('Verify your phone first.',403);
        $device=qha_input($b,'player_id',100);if (!preg_match('/^[a-zA-Z0-9-]{20,100}$/',$device)) qha_fail('Invalid push subscription.');
        $update=qha_query('UPDATE user_devices SET phone_number=?,updated_at=NOW() WHERE player_id=?',[$u['phone_no'],$device]);
        if (!$update->affected_rows) qha_query('INSERT INTO user_devices (player_id,phone_number,created_at,updated_at) VALUES (?,?,NOW(),NOW())',[$device,$u['phone_no']]);
        $out=['saved'=>true];break;
    case 'logout':
        $_SESSION=[];session_regenerate_id(true);$_SESSION['qha_csrf']=bin2hex(random_bytes(32));$out=['state'=>'welcome'];break;
    default: qha_fail('Unknown action.',404);
    }
    $out['csrf']=$_SESSION['qha_csrf'];echo json_encode($out);
} catch(QHAMobileError $e) {http_response_code($e->http);echo json_encode(['error'=>$e->getMessage(),'csrf'=>$_SESSION['qha_csrf']]);
} catch(Throwable $e) {error_log('[QuickHelp mobile] '.get_class($e).' code='.$e->getCode());http_response_code(503);echo json_encode(['error'=>'QuickHelp could not complete this request. Please try again.']);}
