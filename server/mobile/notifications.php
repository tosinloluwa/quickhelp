<?php
require __DIR__.'/core.php';qha_start();
try {
    $u=qha_user();
    if (!$u||!qha_verified($u)) {header('Location: ./?view=login&next=notifications');exit;}
    $aliases=qha_notification_aliases($u['phone_no']);
    $placeholders=implode(',',array_fill(0,count($aliases),'?'));
    $rows=qha_query('SELECT id,notification_id,title,message,data,sent_at,read_at FROM user_notifications WHERE phone_number IN ('.$placeholders.') OR phone_number=? ORDER BY id DESC LIMIT 100',array_merge($aliases,['GLOBAL']))->get_result()->fetch_all(MYSQLI_ASSOC);
    $items=[];
    foreach($rows as $row){
        $data=json_decode($row['data']??'',true);
        $items[]=['id'=>$row['notification_id']?:'db-'.$row['id'],'title'=>$row['title']?:'QuickHelp notification',
            'body'=>$row['message'],'type'=>is_array($data)&&is_string($data['type']??null)?$data['type']:'general',
            'time'=>$row['sent_at'],'read'=>!empty($row['read_at'])];
    }
    $clicked=$_SESSION['qha_clicked_notification']??null;unset($_SESSION['qha_clicked_notification']);
    $payload=json_encode(['items'=>$items,'clicked'=>$clicked,'user_id'=>(string)$u['id']],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_INVALID_UTF8_SUBSTITUTE);
} catch(QHAMobileError $e){
    if($e->http===401){header('Location: ./?view=login&next=notifications');exit;}
    http_response_code(503);echo 'Notifications are temporarily unavailable. Please return to QuickHelp and try again.';exit;
} catch(Throwable $e){http_response_code(503);echo 'Notifications are temporarily unavailable. Please return to QuickHelp and try again.';exit;}
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Notifications · QuickHelp</title><link rel="stylesheet" href="styles.css?v=150">
<style>.inbox{padding:20px 0;border-top:1px solid var(--border,#40584d)}.inbox p{white-space:pre-wrap;overflow-wrap:anywhere}.inbox h2{font-size:1.2rem;overflow-wrap:anywhere}.read{opacity:.7}.meta{font-size:.85rem}.button{text-decoration:none;display:block;text-align:center;box-sizing:border-box}.read-button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:12px;padding:8px 12px;cursor:pointer}</style>
</head><body><main class="app"><header><img class="logo" src="logo.png" alt="QuickHelp"><button class="theme" id="theme" aria-label="Switch colour theme">◐</button></header><div class="eyebrow">Your updates</div><h1>Notifications</h1><p>Messages for your account and community announcements.</p><a class="button primary" href="/chat.php">Return to Chat →</a><div id="notifications-list" aria-live="polite"></div></main>
<script>
(()=>{
 'use strict';
 const data=<?=$payload?>;
 let theme='light';try{theme=localStorage.getItem('qh-theme')==='dark'?'dark':'light';}catch(e){}
 document.documentElement.dataset.theme=theme;
 document.getElementById('theme').onclick=()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('qh-theme',theme);}catch(e){}};
 const key='qh-notifications-'+data.user_id, readKey=key+'-read';
 let cached=[],read=[];
 try{cached=JSON.parse(localStorage.getItem(key)||'[]');read=JSON.parse(localStorage.getItem(readKey)||'[]');}catch(e){}
 if(!Array.isArray(cached))cached=[];if(!Array.isArray(read))read=[];
 const byId=new Map();
 for(const item of [...data.items,...cached])if(item&&typeof item.id==='string'&&!byId.has(item.id))byId.set(item.id,item);
 if(data.clicked&&typeof data.clicked.id==='string')byId.set(data.clicked.id,{...byId.get(data.clicked.id),...data.clicked});
 const clickedId=data.clicked&&typeof data.clicked.id==='string'?data.clicked.id:null;
 const items=[...(clickedId?[byId.get(clickedId)]:[]),...[...byId.values()].filter(item=>item.id!==clickedId)].slice(0,100);
 try{localStorage.setItem(key,JSON.stringify(items));}catch(e){}
 const container=document.getElementById('notifications-list');
 if(!items.length){const p=document.createElement('p');p.textContent='No notifications yet.';container.append(p);}
 for(const item of items){
  const card=document.createElement('article');card.className='inbox';if(item.read||read.includes(item.id))card.classList.add('read');
  const title=document.createElement('h2');title.textContent=typeof item.title==='string'?item.title:'QuickHelp notification';
  const body=document.createElement('p');body.textContent=typeof item.body==='string'?item.body:'';
  card.append(title,body);
  if(typeof item.time==='string'){const time=document.createElement('p');time.className='meta';time.textContent=item.time;card.append(time);}
  const close=document.createElement('button');close.className='read-button';close.textContent='Mark as read';
  close.onclick=()=>{card.classList.add('read');read=[...new Set([...read,item.id])].slice(-200);try{localStorage.setItem(readKey,JSON.stringify(read));}catch(e){}};
  card.append(close);container.append(card);
 }
})();
</script></body></html>
