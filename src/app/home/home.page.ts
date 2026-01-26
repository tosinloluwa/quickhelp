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
    if (typeof window.OneSignal === 'undefined') {
      console.warn('OneSignal plugin not available - make sure plugin is installed and app rebuilt');
      return;
    }

    // Initialize with your OneSignal App ID (from onesignal.com dashboard)
    // Note: Recent versions (2025+) use initialize() instead of startInit/endInit
    window.OneSignal.initialize('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');

    // Prompt user for permission (shows native prompt on Android/iOS)
    window.OneSignal.Notifications.requestPermission((granted: boolean) => {
      console.log('Push permission granted:', granted);
      if (granted) {
        this.getAndSendPlayerId();
      }
    });

    // Handle notification received while app is in foreground
    window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      console.log('Foreground notification received:', event);
      // Optional: Prevent auto-display and show custom toast/alert instead
      // event.preventDefault();
      // event.getNotification().display(); // or skip
    });

    // Handle when user taps/clicks the notification (app opens or in foreground)
    window.OneSignal.Notifications.addEventListener('click', (event: any) => {
      console.log('Notification clicked:', event);
      const data = event?.notification?.additionalData || {};

      // Example: If your backend sends custom data like { action: 'open_chat' }
      if (data?.action === 'open_chat' || data?.type === 'ride_request') {
        // Show iframe if not already visible
        this.loadIframe();
        // Optional: Scroll to top or focus iframe
        if (this.chatIframe?.nativeElement) {
          this.chatIframe.nativeElement.contentWindow?.focus?.();
        }
      }

      // You can add more handling based on payload
    });
  }

  // Fetch Player ID and send to backend
  private getAndSendPlayerId() {
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
        }
      })
      .catch((err: any) => {
        console.error('Error getting OneSignal Player ID:', err);
      });
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