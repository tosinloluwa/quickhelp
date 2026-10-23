import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, Platform } from '@ionic/angular/standalone';
import OneSignal from 'onesignal-cordova-plugin';

interface BrowserEvent { url?: string; data?: { type?: string; url?: string }; }
interface AppBrowser {
  addEventListener(name: string, callback: (event: BrowserEvent, continueLoad?: (url: string) => void) => void): void;
  executeScript(details: { code: string }): void;
  close(): void;
  show(): void;
}
interface BrowserPlugin { open(url: string, target: string, options?: string): AppBrowser; }

@Component({selector:'app-home',templateUrl:'home.page.html',styleUrls:['home.page.scss'],standalone:true,imports:[CommonModule,IonContent]})
export class HomePage implements OnInit, OnDestroy {
  ready=false;
  loading=false;
  error='';
  theme='light';
  private browser?: AppBrowser;
  private currentUrl='';
  private subscriptionId='';
  private timeout?: ReturnType<typeof setTimeout>;
  private destination='chat';
  private readonly origin='https://quickhelp.com.ng';
  private readonly resume=()=>this.injectBridge();
  private readonly pushChange=(event: {current: {id?: string | null}})=>{this.subscriptionId=event.current.id||'';this.injectBridge();};
  private readonly pushClick=(event: {notification: {additionalData?: object}})=>{
    const data=event.notification.additionalData as {page?: string;action?: string}|undefined;
    this.zone.run(()=>this.open('auto',data?.page==='notifications'||data?.action==='open_notifications'?'notifications':'chat'));
  };
  constructor(private platform: Platform,private zone: NgZone) {
    try {this.theme=localStorage.getItem('qh-theme')==='dark'?'dark':'light';}catch { /* Default remains light. */ }
    try {
      // Remove the old phone-as-login marker and cached profile data on upgrade.
      for(const key of ['userPhone','email','didiname','lastname','session_inout','session_user','user_session']) localStorage.removeItem(key);
    }catch { /* Authentication is server-side if browser storage is unavailable. */ }
  }
  ngOnInit(): void {
    this.platform.ready().then(()=>{
      this.ready=true;
      document.addEventListener('resume',this.resume);
      if(this.platform.is('cordova'))this.initPush();
    });
  }
  toggleTheme(): void {this.theme=this.theme==='light'?'dark':'light';try{localStorage.setItem('qh-theme',this.theme);}catch{/* Theme is optional storage. */}}
  private get plugin(): BrowserPlugin|undefined {
    return (window as unknown as {cordova?: {InAppBrowser?: BrowserPlugin}}).cordova?.InAppBrowser;
  }
  open(view='welcome',next='chat'): void {
    if(!this.ready)return;
    this.cancel();this.destination=next;this.error='';this.loading=true;
    const url=`${this.origin}/mobile/?view=${encodeURIComponent(view)}&next=${encodeURIComponent(next)}&theme=${this.theme}`;
    if(!this.platform.is('cordova')) {window.location.assign(url);return;}
    const plugin=this.plugin;
    if(!plugin){this.loading=false;this.error='This installation is missing the secure browser component. Please update the app.';return;}
    const ref=plugin.open(url,'_blank','location=no,hidden=yes,hardwareback=yes,zoom=no,beforeload=get,clearcache=no,clearsessioncache=no');
    this.browser=ref;
    ref.addEventListener('loadstart',event=>{this.currentUrl=event.url||'';});
    ref.addEventListener('beforeload',(event,continueLoad)=>{
      try {
        const target=new URL(event.url||'');
        if(target.protocol==='https:'&&target.hostname==='accounts.google.com'){plugin.open(target.href,'_system');return;}
        if(target.protocol==='https:'){continueLoad?.(target.href);return;}
        if(['tel:','sms:','mailto:','geo:'].includes(target.protocol))plugin.open(target.href,'_system');
      }catch{/* Reject malformed or executable navigation. */}
    });
    ref.addEventListener('loadstop',event=>{
      if(this.browser!==ref)return;
      this.currentUrl=event.url||'';clearTimeout(this.timeout);ref.show();this.injectBridge();
      this.zone.run(()=>{this.loading=false;});
    });
    ref.addEventListener('loaderror',()=>{if(this.browser!==ref)return;this.zone.run(()=>{this.cancel();this.error='We couldn’t reach QuickHelp. Check your connection and try again.';});});
    ref.addEventListener('exit',()=>{if(this.browser===ref){clearTimeout(this.timeout);this.browser=undefined;this.zone.run(()=>this.loading=false);}});
    ref.addEventListener('message',event=>{
      if(!this.isAuthPage()||event.data?.type!=='google'||!event.data.url)return;
      try {const target=new URL(event.data.url);if(target.origin==='https://accounts.google.com'&&target.pathname==='/o/oauth2/v2/auth')plugin.open(target.href,'_system');}catch{/* Invalid provider URL. */}
    });
    this.timeout=setTimeout(()=>this.zone.run(()=>{if(this.browser===ref&&this.loading){this.cancel();this.error='QuickHelp took too long to respond. Please try again.';}}),20000);
  }
  retry(): void {this.open('auto',this.destination);}
  cancel(): void {clearTimeout(this.timeout);const ref=this.browser;this.browser=undefined;ref?.close();this.loading=false;this.currentUrl='';}
  private isAuthPage(): boolean {try{const url=new URL(this.currentUrl);return url.origin===this.origin&&['/mobile/','/mobile/index.php'].includes(url.pathname);}catch{return false;}}
  private injectBridge(): void {
    if(!this.browser||!this.isAuthPage())return;
    this.browser.executeScript({code:`window.qhNativeDevice?.(${JSON.stringify(this.subscriptionId)});window.qhNativeStart?.();window.qhResume?.();`});
  }
  private initPush(): void {
    try {
      OneSignal.initialize('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');
      this.subscriptionId=OneSignal.User.pushSubscription.id||'';
      OneSignal.User.pushSubscription.addEventListener('change',this.pushChange);
      OneSignal.Notifications.addEventListener('click',this.pushClick);
      // Permission is requested on a user action, not while the splash screen is showing.
    }catch{/* Push availability must not block authentication. */}
  }
  enableNotifications(): void {OneSignal.Notifications.requestPermission(true).catch(()=>undefined);}
  ngOnDestroy(): void {
    this.cancel();document.removeEventListener('resume',this.resume);
    if(this.platform.is('cordova')){try{OneSignal.User.pushSubscription.removeEventListener('change',this.pushChange);OneSignal.Notifications.removeEventListener('click',this.pushClick);}catch{/* Optional native cleanup. */}}
  }
}
