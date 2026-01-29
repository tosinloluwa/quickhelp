import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';

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

  constructor(
    private platform: Platform,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.platform.ready().then(() => {
      this.initOneSignal();          // Start push setup here
      this.checkSiteConnectivity();   // Your original checks
    });

    window.addEventListener('online', () => this.checkSiteConnectivity());
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Poll connectivity every 5 seconds
    setInterval(() => this.checkSiteConnectivity(), 5000);
  }

  // ────────────────────────────────────────────────
  // OneSignal Push Integration (native plugin)
  // ────────────────────────────────────────────────
  initOneSignal() {
    console.log('initOneSignal called - platform ready');

    // In browser (ionic serve), OneSignal won't exist → safe early return
    if (typeof window.OneSignal === 'undefined') {
      console.warn('OneSignal plugin NOT available in this environment (browser expected)');
      return;
    }

    console.log('OneSignal object found on window');

    try {
      // Modern init (works with onesignal-cordova-plugin >= 3.x / latest)
      window.OneSignal.initialize('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');
      console.log('OneSignal.initialize() executed successfully');
    } catch (err) {
      console.error('Error during OneSignal.initialize():', err);
      // Fallback for older plugin versions (uncomment if needed after plugin update)
      // window.OneSignal.startInit('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');
      // window.OneSignal.endInit();
      // console.log('Fallback startInit/endInit used');
    }

    // Enable verbose logging for device debugging (comment out after testing)
    // (window as any).OneSignal.setLogLevel(6, 0);  // TS error safe in browser; works on device
    console.log('OneSignal verbose logging enabled (if supported)');

    // Request permission
    try {
      window.OneSignal.Notifications.requestPermission((granted: boolean) => {
        console.log('Permission request callback fired. Granted:', granted);
        if (granted) {
          this.getAndSendPlayerId();
        } else {
          console.log('Permission was denied or not supported');
        }
      });
    } catch (err) {
      console.error('Error requesting permission:', err);
    }

    // Foreground notification handler
    try {
      window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('Foreground notification received:', event);
        // Optional: Display manually or suppress
        // event.preventDefault();
        // event.getNotification().display();
      });
    } catch (err) {
      console.error('Error adding foreground listener:', err);
    }

    // Notification click handler
    try {
      window.OneSignal.Notifications.addEventListener('click', (event: any) => {
        console.log('Notification clicked:', event);
        const data = event?.notification?.additionalData || {};

        if (data?.action === 'open_chat' || data?.type === 'ride_request') {
          console.log('Handling deep link: open chat');
          this.loadIframe();
          if (this.chatIframe?.nativeElement) {
            this.chatIframe.nativeElement.contentWindow?.focus?.();
          }
        }
      });
    } catch (err) {
      console.error('Error adding click listener:', err);
    }
  }

  // Fetch Player ID and send to backend
  private getAndSendPlayerId() {
    try {
      window.OneSignal.User.getOnesignalId()
        .then((playerId: string | null) => {
          if (playerId) {
            console.log('OneSignal Player ID:', playerId);

            // Send to your PHP backend
            this.http.post('https://quickhelp.com.ng/api/save-device.php', {
              player_id: playerId,
              // Optional: add user_id, device_info, auth_token if you have login
              // user_id: this.currentUserId || 'guest',
            }).subscribe({
              next: (res) => console.log('Player ID saved on server:', res),
              error: (err) => console.error('Failed to save Player ID:', err)
            });
          } else {
            console.warn('No Player ID returned');
          }
        })
        .catch((err: any) => {
          console.error('Error getting OneSignal Player ID:', err);
        });
    } catch (err) {
      console.error('Critical error in getAndSendPlayerId:', err);
    }
  }

  // ────────────────────────────────────────────────
  // Your original connectivity / iframe methods (unchanged)
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
      console.log('Failed to connect to QuickHelp:', error);
      this.canConnect = false;
      this.isOffline = true;
    }

    if (this.isIframeActive && !this.canConnect) {
      this.isIframeActive = false;
    }
  }

  loadIframe() {
    if (this.canConnect) {
      this.isIframeActive = true;
      this.isOffline = false;
    }
  }

  onIframeLoad() {
    console.log('Iframe loaded successfully');
    this.isOffline = false;
  }

  onIframeError() {
    console.log('Iframe failed to load');
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

  retryConnection() {
    this.isIframeActive = false;
    this.checkSiteConnectivity();
    if (this.chatIframe && this.canConnect) {
      this.chatIframe.nativeElement.src = 'https://quickhelp.com.ng/chat.php';
    }
  }
}