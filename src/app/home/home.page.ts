import { Component, OnInit, ViewChild, ElementRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText } from '@ionic/angular/standalone';
import { Platform, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';

// Modern modular import for OneSignal v5+ (cordova plugin)
import OneSignal from 'onesignal-cordova-plugin'; 

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText],
})
export class HomePage implements OnInit {
  @ViewChild('chatIframe', { static: false }) chatIframe!: ElementRef<HTMLIFrameElement>;
  isIframeActive = false;
  isOffline = false;
  canConnect = false;
  private userPlayerId: string | null = null;

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.platform.ready().then(() => {
      this.initOneSignal();
      this.checkSiteConnectivity();
    });

    // INSTANT: OS notifies when connection returns
    window.addEventListener('online', () => {
      console.log('OS detected Online - checking immediately');
      this.retryConnection(); 
    });

    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // BACKGROUND: Poll every 15 seconds
    setInterval(() => this.checkSiteConnectivity(), 15000);
  }

  // ────────────────────────────────────────────────
  // OneSignal Push Integration (Native Plugin v5+)
  // ────────────────────────────────────────────────
  async initOneSignal() {
    console.log('initOneSignal called - platform ready');

    if (!this.platform.is('hybrid')) {
      console.warn('OneSignal skipped: Not running on native device');
      return;
    }

    try {
      // 1. Initialize
      await OneSignal.initialize('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');
      console.log('OneSignal initialized successfully');

      // 2. Setup Subscription Listener (catches ID when ready)
      (OneSignal.User as any).pushSubscription.addEventListener("change", (event: any) => {
        const newId = event.current.id;
        console.log("Push Subscription Changed. New ID:", newId);
        if (newId) {
          this.userPlayerId = newId;
          const savedPhone = localStorage.getItem('userPhone');
          this.sendToBackend(newId, savedPhone);
        }
      });

      // 3. Request permission
      const granted = await OneSignal.Notifications.requestPermission(true);
      if (granted) {
        await this.getAndSendPlayerId();
      }

      // 4. Foreground Notification Listener
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('Foreground notification received:', event);
      });

      // 5. Click Handler
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        const data = event?.notification?.additionalData || {};
        if (data?.action === 'open_chat' || data?.type === 'ride_request') {
          this.loadIframe();
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

  // ────────────────────────────────────────────────
  // Prompt for Phone on "Start Chat" button tap
  // ────────────────────────────────────────────────
  async loadIframe() {
    if (!this.canConnect) return;

    const savedPhone = localStorage.getItem('userPhone');

    // If no phone saved → prompt user
    if (!savedPhone) {
      const alert = await this.alertController.create({
        header: 'Welcome to QuickHelp!',
        subHeader: 'Your Phone number is required to receive QuickHelp Notifications and Updates. You will be doing this only once.',
        cssClass: 'custom-alert',
        inputs: [
          {
            name: 'phone',
            type: 'tel',
            placeholder: 'e.g. 08012345678',
            attributes: {
              maxlength: 11
            }
          }
        ],
        buttons: [
          {
            text: 'MAYBE LATER',
            role: 'cancel',
            handler: () => {
              this.proceedToChat();
            }
          },
          {
            text: 'START CHAT',
            handler: (data) => {
              if (data.phone && data.phone.length >= 10) {
                this.saveUserPhone(data.phone);
                return true;
              }
              return false; // Keep alert open if invalid
            }
          }
        ]
      });

      await alert.present();
    } else {
      this.proceedToChat();
    }
  }

  private saveUserPhone(phone: string) {
    localStorage.setItem('userPhone', phone);
    
    // Tag in OneSignal dashboard (optional but useful)
    try {
      (OneSignal.User as any).addTag("phone_number", phone);
    } catch (e) {
      console.error("OneSignal Tagging failed", e);
    }

    // Update DB with phone number
    if (this.userPlayerId) {
      this.sendToBackend(this.userPlayerId, phone);
    }
    
    this.proceedToChat();
  }

  private proceedToChat() {
    this.isIframeActive = true;
    this.isOffline = false;
  }

  // ────────────────────────────────────────────────
  // Original connectivity methods
  // ────────────────────────────────────────────────
  async checkSiteConnectivity() {
    try {
      await fetch('https://quickhelp.com.ng/chat.php', {
        method: 'HEAD',
        mode: 'no-cors',
      });
      this.canConnect = true;
      this.isOffline = false;
    } catch (error) {
      this.canConnect = false;
      this.isOffline = true;
    }

    if (this.isIframeActive && !this.canConnect) {
      this.isIframeActive = false;
    }
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

        // Force reload iframe with cache bust
        if (this.chatIframe?.nativeElement) {
          const iframe = this.chatIframe.nativeElement;
          iframe.src = 'https://quickhelp.com.ng/chat.php?' + Date.now();
        }
      } else {
        console.log('Retry failed: Still no connection.');
      }
    } catch (error) {
      console.error('Retry error:', error);
    }
  }
}