/* Same-origin UI. Authentication and phone verification are decided by PHP, never localStorage. */
(() => {
  'use strict';
  let csrf=document.querySelector('meta[name="qh-csrf"]').content;
  let view='loading', phone='', cooldown=0, pollTimer, timer, googleDeadline=0, pending=false, deviceId='', controller, googleEnabled=false;
  let deviceSync=null, linkedDeviceId='', linkedPhone='', deviceEpoch=0;
  let clickedNotification=null;
  const screen=document.getElementById('screen'), error=document.getElementById('error');
  const initial=new URLSearchParams(location.search).get('view')||'welcome';
  let theme='light';try {theme=localStorage.getItem('qh-theme')==='dark'?'dark':'light';}catch(e){}
  const requestedTheme=new URLSearchParams(location.search).get('theme');if(['light','dark'].includes(requestedTheme))theme=requestedTheme;document.documentElement.dataset.theme=theme;
  document.getElementById('theme').onclick=()=>{theme=theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('qh-theme',theme);}catch(e){}};
  function show(name) {
    const t=document.getElementById(name);if(!t||t.tagName!=='TEMPLATE')return;
    view=name;screen.replaceChildren(t.content.cloneNode(true));error.textContent='';
    if(!googleEnabled)screen.querySelectorAll('[data-google]').forEach(b=>b.hidden=true);
    for(const el of screen.querySelectorAll('[data-phone]'))el.textContent=phone?'+'+phone.slice(0,6)+' ••• '+phone.slice(-4):'';
    const input=screen.querySelector('#phone');if(input)input.value=phone.replace(/^234/,'');
    if(name!=='waiting')clearTimeout(pollTimer);
    updateResend();
  }
  async function api(action,data={}) {
    const abort=new AbortController();controller=abort;
    const timeout=setTimeout(()=>abort.abort(),22000);
    try {
      const response=await fetch('api.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,action,csrf}),signal:abort.signal});
      const result=await response.json();if(result.csrf)csrf=result.csrf;
      if(!response.ok||result.error)throw new Error(result.error||'Please try again.');return result;
    } catch(e){if(e.name==='AbortError')throw new Error('The connection timed out. Please try again.');throw e;}
    finally{clearTimeout(timeout);if(controller===abort)controller=null;}
  }
  function accept(r) {
    if(typeof r.google_enabled==='boolean')googleEnabled=r.google_enabled;
    if(typeof r.phone==='string')phone=r.phone;
    if(r.state==='code')cooldown=Date.now()+30000;
    show(r.state||'welcome');
    if(r.state==='ready'||r.state==='success')saveDevice();
    else {linkedDeviceId='';linkedPhone='';deviceEpoch++;if(r.logged_out)clickedNotification=null;bridge({type:'push-cleared',signed_out:r.logged_out===true});}
  }
  function saveDevice(){
    if(!deviceId||!['ready','success'].includes(view))return Promise.resolve();
    if(deviceSync)return deviceSync;
    if(linkedDeviceId===deviceId){bridge({type:'push-linked',player_id:deviceId,phone_number:linkedPhone});return Promise.resolve();}
    const id=deviceId, epoch=deviceEpoch;
    deviceSync=api('device',{player_id:id}).then(r=>{
      if(epoch!==deviceEpoch||!['ready','success'].includes(view)||id!==deviceId)return;
      if(r.saved&&r.player_id===id&&/^234[789]\d{9}$/.test(r.phone_number||'')){
        linkedDeviceId=id;
        linkedPhone=r.phone_number;
        bridge({type:'push-linked',player_id:id,phone_number:r.phone_number});
      }
    }).catch(()=>{/* Retry on the next app resume or Continue action. */}).finally(()=>{
      deviceSync=null;
      if(id!==deviceId&&epoch===deviceEpoch)saveDevice();
    });
    return deviceSync;
  }
  window.qhNativeDevice=id=>{if(typeof id==='string'){deviceId=id;if(view==='ready'||view==='success')saveDevice();}};
  window.qhNativeNotification=value=>{
    if(value&&typeof value==='object'&&typeof value.id==='string'&&typeof value.title==='string'&&typeof value.body==='string'){
      clickedNotification={id:value.id.slice(0,100),title:value.title.slice(0,255),body:value.body.slice(0,8000),type:typeof value.type==='string'?value.type.slice(0,40):'general'};
    }
  };
  let googleStarted=false;
  window.qhNativeStart=()=>{if(initial==='google'&&view==='welcome'&&!googleStarted&&window.webkit?.messageHandlers?.cordova_iab){googleStarted=true;google();}};
  function bridge(data){if(window.webkit?.messageHandlers?.cordova_iab){window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(data));return true;}return false;}
  async function google(){
    if(pending)return;
    // Open synchronously for normal browsers; Android uses the native message bridge.
    const native=!!window.webkit?.messageHandlers?.cordova_iab;const tab=native?null:window.open('about:blank','_blank');
    pending=true;error.textContent='';
    try {const r=await api('google-start');if(native)bridge({type:'google',url:r.url});else if(tab){tab.opener=null;tab.location.href=r.url;}else throw new Error('Please allow the Google sign-in window and try again.');
      googleDeadline=Date.now()+300000;show('waiting');pollTimer=setTimeout(poll,2500);
    }catch(e){if(tab)tab.close();error.textContent=e.message;}finally{pending=false;}
  }
  async function poll(){
    if(view!=='waiting'||pending)return;clearTimeout(pollTimer);
    if(Date.now()>googleDeadline){error.textContent='Google sign-in expired. Cancel and try again.';return;}
    pending=true;
    try{const r=await api('google-poll');if(r.state!=='waiting')accept(r);}
    catch(e){error.textContent=e.message;}
    finally{pending=false;if(view==='waiting')pollTimer=setTimeout(poll,3000);}
  }
  window.qhResume=()=>{if(view==='waiting')poll();else saveDevice();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view==='waiting')poll();});
  function updateResend(){const b=screen.querySelector('[data-resend]');if(!b)return;const s=Math.max(0,Math.ceil((cooldown-Date.now())/1000));b.disabled=s>0||pending;b.textContent=s?'Resend code in '+s+'s':'Resend code';}
  timer=setInterval(updateResend,1000);
  async function run(action,data={}) {
    if(pending)return;pending=true;error.textContent='';const buttons=[...screen.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{accept(await api(action,data));}catch(e){error.textContent=e.message||'Unable to connect. Please try again.';}
    finally{pending=false;buttons.forEach(b=>b.disabled=false);updateResend();}
  }
  async function boot(){show('loading');try {const r=await api('status');if(r.state==='welcome'&&['login','signup'].includes(initial)){accept(r);show(initial);}else if(r.state==='welcome'&&initial==='google'){accept(r);show('welcome');/* Explicit native launch follows bootstrap. */}else accept(r);window.qhNativeStart();}catch(e){show('offline');error.textContent=e.message;}}
  screen.addEventListener('submit',e=>{e.preventDefault();run(e.target.dataset.action,Object.fromEntries(new FormData(e.target)));});
  screen.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.view){show(b.dataset.view);return;}
    if(b.hasAttribute('data-google'))google();
    if(b.hasAttribute('data-google-check'))poll();
    if(b.hasAttribute('data-google-cancel')){clearTimeout(pollTimer);if(controller)controller.abort();pending=false;await run('google-cancel');}
    if(b.hasAttribute('data-password')){const p=screen.querySelector('#password');p.type=p.type==='password'?'text':'password';b.textContent=p.type==='password'?'Show':'Hide';}
    if(b.hasAttribute('data-resend'))run('send-code',{phone});
    if(b.hasAttribute('data-logout')){if(deviceSync)await deviceSync;run('logout',{player_id:deviceId});}
    if(b.hasAttribute('data-retry'))boot();
    if(b.hasAttribute('data-cancel')){if(controller)controller.abort();show('welcome');}
    if(b.hasAttribute('data-enter')){
      b.disabled=true;
      await saveDevice();
      if(deviceSync)await deviceSync;
      const form=document.createElement('form');form.method='POST';form.action='enter.php';
      const fields={csrf};if(clickedNotification)fields.notification=JSON.stringify(clickedNotification);
      for(const [name,value] of Object.entries(fields)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
      document.body.append(form);form.submit();
    }
  });
  screen.addEventListener('input',e=>{if(e.target.id==='code')e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);});
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(pollTimer);if(controller)controller.abort();});
  boot();
})();
