import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Added for ngModel
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon } from '@ionic/angular/standalone';
import { Platform, ToastController } from '@ionic/angular'; // Removed AlertController (no longer needed)
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, refreshOutline } from 'ionicons/icons';

// Modern modular import for OneSignal v5+ (cordova plugin)
import OneSignal from 'onesignal-cordova-plugin';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, // Added for ngModel in modal
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSpinner,
    IonButton,
    IonText,
    IonIcon
  ],
})
export class HomePage implements OnInit {
  @ViewChild('chatIframe', { static: false }) chatIframe!: ElementRef<HTMLIFrameElement>;
  isIframeActive = false;
  isOffline = false;
  canConnect = false;
  isAppReady = false;
  private userPlayerId: string | null = null;

  // Registration modal properties
  showRegModal = false;
  regForm = { last_name: '', first_name: '', email: '', phone_no: '', password: '', confirm_password: '' };
  regError = '';
  regSuccess = '';
  isSubmitting = false;

  iframeSrc!: SafeResourceUrl;                    // ← Add this

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private toastController: ToastController,
    private sanitizer: DomSanitizer
  ) {
    addIcons({
      'cloud-offline-outline': cloudOfflineOutline,
      'refresh-outline': refreshOutline
    });

this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl('');

  }

  ngOnInit() {
    this.platform.ready().then(() => {
      this.initOneSignal();
      this.checkSiteConnectivity();
      this.isAppReady = true;
    });

    window.addEventListener('online', () => {
      console.log('OS detected Online - checking immediately');
      this.retryConnection();
    });

    window.addEventListener('offline', () => this.handleNetworkChange(false));

    setInterval(() => this.checkSiteConnectivity(), 15000);
  }

  async initOneSignal() {
    console.log('initOneSignal called - platform ready');

    if (!this.platform.is('hybrid')) {
      console.warn('OneSignal skipped: Not running on native device');
      return;
    }

    try {
      await OneSignal.initialize('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');
      console.log('OneSignal initialized successfully');

      (OneSignal.User as any).pushSubscription.addEventListener("change", (event: any) => {
        const newId = event.current.id;
        console.log("Push Subscription Changed. New ID:", newId);
        if (newId) {
          this.userPlayerId = newId;
          const savedPhone = localStorage.getItem('userPhone');
          this.sendToBackend(newId, savedPhone);
        }
      });

      const granted = await OneSignal.Notifications.requestPermission(true);
      if (granted) {
        await this.getAndSendPlayerId();
      }

      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('Foreground notification received:', event);
      });

      OneSignal.Notifications.addEventListener('click', (event: any) => {
  const data = event?.notification?.additionalData || {};
  const notifTitle = event?.notification?.title || '';
  const notifBody  = event?.notification?.body || '';

  console.log('🛎️ Notification clicked →', { title: notifTitle, body: notifBody, data });

  if (data?.page === 'notifications' || data?.action === 'open_notifications') {
    this.loadNotificationPage({
      title: notifTitle,
      body: notifBody,
      type: data.type || 'general'
    });
  } else {
    this.loadIframe();   // fallback to chat
  }
});
    } catch (error) {
      console.error('Critical error in OneSignal setup:', error);
    }
  }

  private async getAndSendPlayerId() {
    try {
      const playerId = (OneSignal.User as any).pushSubscription.id;
      if (playerId) {
        this.userPlayerId = playerId;
        const savedPhone = localStorage.getItem('userPhone');
        this.sendToBackend(playerId, savedPhone);
      }
    } catch (error) {
      console.error('Error in manual ID check:', error);
    }
  }

  private sendToBackend(playerId: string, phone: string | null = null) {
    console.log('Sending to backend:', { playerId, phone });
    this.http.post('https://quickhelp.com.ng/api/save-device.php', {
      player_id: playerId,
      phone: phone
    }).subscribe({
      next: (res) => console.log('Server response:', res),
      error: (err) => console.error('Server error:', err)
    });
  }

  async loadIframe() {
    console.log('loadIframe() was called!');

    if (!this.isAppReady) {
      console.log('App not fully ready yet - ignoring click');
      return;
    }

    if (!this.canConnect) {
      console.log('No connection - quick retry...');
      await this.checkSiteConnectivity();
      if (!this.canConnect) {
        const toast = await this.toastController.create({
          message: 'Still connecting to server... please check your internet or try again.',
          duration: 4000,
          position: 'bottom',
          color: 'warning',
          buttons: [
            {
              text: 'Retry',
              handler: () => this.retryConnection()
            }
          ]
        });
        await toast.present();
        return;
      }
    }

    const savedPhone = localStorage.getItem('userPhone');

    if (savedPhone) {
      this.proceedToChat();
      return;
    }

    console.log('No phone saved - showing registration modal');
    this.regForm = { last_name: '', first_name: '', email: '', phone_no: '', password: '', confirm_password: '' };
    this.regError = '';
    this.regSuccess = '';
    this.showRegModal = true;
  }

  async submitRegistration() {
    const { last_name, first_name, email, phone_no, password } = this.regForm;

    if (!last_name || !first_name || !email || !phone_no || !password) {
      this.regError = 'Please fill in all fields.';
      return;
    }

    if (phone_no.length < 10 || !/^\d+$/.test(phone_no)) {
      this.regError = 'Please enter a valid phone number (10+ digits).';
      return;
    }
    if (this.regForm.password !== this.regForm.confirm_password) {
  this.regError = 'Passwords do not match.';
  return;
}

    this.isSubmitting = true;
    this.regError = '';

    try {
      const response = await fetch('https://quickhelp.com.ng/api/register-app-user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_name, first_name, email, username: email, phone_no, password })
      });

      const result = await response.json();

      if (result.status === 'success') {
        this.regSuccess = 'Account created! Loading chat...';
        this.showRegModal = false;
        this.saveUserPhone(phone_no);
      } else {
        this.regError = result.error || 'Registration failed. Please try again.';
      }
    } catch (e) {
      this.regError = 'Network error. Please check your connection.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private saveUserPhone(phone: string) {
    localStorage.setItem('userPhone', phone);
    localStorage.setItem('didiname', this.regForm.first_name);
    localStorage.setItem('email', this.regForm.email);
    localStorage.setItem('lastname', this.regForm.last_name);

    try {
      (OneSignal.User as any).addTag("phone_number", phone);
    } catch (e) {
      console.error("OneSignal Tagging failed", e);
    }

    if (this.userPlayerId) {
      this.sendToBackend(this.userPlayerId, phone);
    }

    this.proceedToChat();
  }

  private loadNotificationPage(data: any = {}) {
  const phone = localStorage.getItem('userPhone') || '';
  const firstname = localStorage.getItem('didiname') || '';
  const email = localStorage.getItem('email') || '';
  const lastname = localStorage.getItem('lastname') || '';

  let url = `https://quickhelp.com.ng/notifications.php?phone=${encodeURIComponent(phone)}&firstname=${encodeURIComponent(firstname)}&email=${encodeURIComponent(email)}&lastname=${encodeURIComponent(lastname)}&t=${Date.now()}`;

  // Pass notification content from OneSignal
  if (data.title) url += `&title=${encodeURIComponent(data.title)}`;
  if (data.body)  url += `&body=${encodeURIComponent(data.body)}`;
  if (data.type)  url += `&type=${encodeURIComponent(data.type)}`;

  this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  this.isIframeActive = true;
  this.isOffline = false;
}

private proceedToChat() {
  const phone = localStorage.getItem('userPhone') || '';
  const firstname = localStorage.getItem('didiname') || '';
  const email = localStorage.getItem('email') || '';
  const lastname = localStorage.getItem('lastname') || '';

  const url = `https://quickhelp.com.ng/chat.php?phone=${encodeURIComponent(phone)}&firstname=${encodeURIComponent(firstname)}&email=${encodeURIComponent(email)}&lastname=${encodeURIComponent(lastname)}&t=${Date.now()}`;

  this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(url);

  this.isIframeActive = true;
  this.isOffline = false;
}

  async checkSiteConnectivity() {
    if (!this.platform.is('hybrid')) {
      this.canConnect = true;
      this.isOffline = false;
      console.log('Browser mode: assuming connected');
      return;
    }

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.canConnect = true;
        this.isOffline = false;
        console.log('Connectivity test passed (image loaded)');
        resolve();
      };
      img.onerror = () => {
        this.canConnect = false;
        if (this.isIframeActive) {
          this.isOffline = true;
        }
        console.log('Connectivity test failed (image load error)');
        resolve();
      };
      img.src = 'https://quickhelp.com.ng/favicon.ico?' + Date.now();
    });
  }

  onIframeLoad() {
    this.isOffline = false;
  }

  onIframeError() {
    this.isIframeActive = false;
    this.isOffline = true;
    this.canConnect = false;
  }

  handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.canConnect = false;
      this.isOffline = true;
      this.isIframeActive = false;
    }
    this.checkSiteConnectivity();
  }

async retryConnection() {
  console.log('Turbo Retry initiated...');

  this.isOffline = true;

  try {
    await this.checkSiteConnectivity();

    if (this.canConnect) {
      this.isOffline = false;
      this.isIframeActive = true;

      if (this.chatIframe?.nativeElement) {
        // Reuse the same URL with user data
        this.proceedToChat();
        this.chatIframe.nativeElement.src = (this.iframeSrc as any).changingThisBreaksApplicationSecurity; // Angular hack for reload
      }
    }
  } catch (error) {
    console.error('Retry error:', error);
  }
}
}