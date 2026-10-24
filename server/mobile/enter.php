<?php
require __DIR__.'/core.php';qha_start();
try {
    if ($_SERVER['REQUEST_METHOD']!=='POST'||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['qha_csrf'],$_POST['csrf']))qha_fail('Please reopen QuickHelp.',403);
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>65536)qha_fail('Request too large.',413);
    $u=qha_user();if (!$u||!qha_verified($u)) {header('Location: ./');exit;}
    qha_activate($u);
    $clicked=null;
    if (isset($_POST['notification'])&&is_string($_POST['notification'])&&strlen($_POST['notification'])<=50000) {
        $value=json_decode($_POST['notification'],true);
        if (is_array($value)&&is_string($value['id']??null)&&is_string($value['title']??null)&&is_string($value['body']??null)) {
            $clicked=['id'=>substr($value['id'],0,100),'title'=>substr($value['title'],0,255),
                'body'=>substr($value['body'],0,8000),'type'=>is_string($value['type']??null)?substr($value['type'],0,40):'general'];
            $_SESSION['qha_clicked_notification']=$clicked;
        }
    }
    $db2=qha_dbs()[1];if (!($db2 instanceof mysqli)) qha_fail('The chat session service is unavailable.',503);
    $db2->set_charset('utf8mb4');$chatId=$u['id'].'0101L'.$u['username'].'0101L'.time();
    qha_query("INSERT IGNORE INTO sessions (id,name,secret_code,phone,session,code,username,caller_id,status,marker,connectee) VALUES (NULL,?,?,?,?,?,?,'','','','')",
        [$u['last_name'],$chatId,$u['phone_no'],$_SESSION['session'],$u['code']??'',$u['username']],$db2);
    $destination=($_SESSION['qha_next']??'chat')==='notifications'?'/mobile/notifications.php':'/chat.php';
    $state=json_encode(['session_user'=>$chatId,'user_session'=>$u['username'],'session_inout'=>'in'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);
    $clickedJson=json_encode($clicked,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_INVALID_UTF8_SUBSTITUTE);
} catch(Throwable $e) {http_response_code(503);echo 'QuickHelp could not open your session. Please go back and try again.';exit;}
?>
<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening QuickHelp</title></head><body><p>Opening QuickHelp…</p>
<script>const state=<?=$state?>;const clicked=<?=$clickedJson?>;try{for(const key of Object.keys(state))localStorage.setItem(key,state[key]);if(clicked){const key='qh-notifications-'+<?=json_encode((string)$u['id'])?>;let saved=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(saved))saved=[];localStorage.setItem(key,JSON.stringify([clicked,...saved.filter(n=>n&&n.id!==clicked.id)].slice(0,100)));}}catch(e){}location.replace(<?=json_encode($destination)?>);</script></body></html>
