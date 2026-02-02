import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon } from '@ionic/angular/standalone';
import { Platform, AlertController, ToastController } from '@ionic/angular'; // Added ToastController here
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

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController // Fixed - now properly injected
  ) {
    addIcons({
      'cloud-offline-outline': cloudOfflineOutline,
      'refresh-outline': refreshOutline
    });
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

  async loadIframe() {
    console.log('loadIframe() was called!');

    // Quick retry if not connected
    if (!this.canConnect) {
      console.log('No recent connection - quick retry...');
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

    console.log('No phone saved - showing prompt');

    setTimeout(async () => {
      try {
        const alert = await this.alertController.create({
          header: 'Welcome to QuickHelp!',
          subHeader: 'Your Phone number is required to receive QuickHelp Notifications and Updates. You will be doing this only once.',
          cssClass: 'custom-alert',
          backdropDismiss: false,
          mode: 'ios',
          inputs: [
            {
              name: 'phone',
              type: 'tel',
              placeholder: 'e.g. 08012345678',
              value: '080',
              attributes: { maxlength: 11 }
            }
          ],
          buttons: [           
            {
              text: 'START CHAT',
              handler: (data) => {
                const phone = data.phone?.trim();
                if (phone && phone.length >= 10) {
                  this.saveUserPhone(phone);
                  return true;
                }
                return false;
              }
            }
          ]
        });

        await alert.present();

        const input = document.querySelector('ion-alert input') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      } catch (err) {
        console.error('Alert failed:', err);
      }
    }, 500);
  }

  private saveUserPhone(phone: string) {
    localStorage.setItem('userPhone', phone);

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

  private proceedToChat() {
    this.isIframeActive = true;
    this.isOffline = false;
  }

  async checkSiteConnectivity() {
    if (!this.platform.is('hybrid')) {
      this.canConnect = true;
      this.isOffline = false;
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch('https://quickhelp.com.ng/chat.php', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      this.canConnect = true;
      this.isOffline = false;
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('Connectivity check failed or timed out:', error);
      this.canConnect = false;
      if (this.isIframeActive) {
        this.isOffline = true;
      }
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