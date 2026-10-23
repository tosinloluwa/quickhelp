<?php
require __DIR__.'/core.php';qha_start();
try {
    if ($_SERVER['REQUEST_METHOD']!=='POST'||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['qha_csrf'],$_POST['csrf']))qha_fail('Please reopen QuickHelp.',403);
    $u=qha_user();if (!$u||!qha_verified($u)) {header('Location: ./');exit;}
    qha_activate($u);
    $db2=qha_dbs()[1];if (!($db2 instanceof mysqli)) qha_fail('The chat session service is unavailable.',503);
    $db2->set_charset('utf8mb4');$chatId=$u['id'].'0101L'.$u['username'].'0101L'.time();
    qha_query("INSERT IGNORE INTO sessions (id,name,secret_code,phone,session,code,username,caller_id,status,marker,connectee) VALUES (NULL,?,?,?,?,?,?,'','','','')",
        [$u['last_name'],$chatId,$u['phone_no'],$_SESSION['session'],$u['code']??'',$u['username']],$db2);
    $destination=($_SESSION['qha_next']??'chat')==='notifications'?'/notifications.php':'/chat.php';
    $state=json_encode(['session_user'=>$chatId,'user_session'=>$u['username'],'session_inout'=>'in'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);
} catch(Throwable $e) {http_response_code(503);echo 'QuickHelp could not open your session. Please go back and try again.';exit;}
?>
<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening QuickHelp</title></head><body><p>Opening QuickHelp…</p>
<script>const state=<?=$state?>;try{for(const key of Object.keys(state))localStorage.setItem(key,state[key]);}catch(e){}location.replace(<?=json_encode($destination)?>);</script></body></html>
