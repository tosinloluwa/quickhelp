import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
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

  constructor(
    private platform: Platform,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.platform.ready().then(() => {
      this.initOneSignal();          // Start push setup
      this.checkSiteConnectivity();   // Original checks
    });

    window.addEventListener('online', () => this.checkSiteConnectivity());
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Poll connectivity every 5 seconds
    setInterval(() => this.checkSiteConnectivity(), 5000);
  }

  // ────────────────────────────────────────────────
  // OneSignal Push Integration (Native Plugin v5+)
  // ────────────────────────────────────────────────
  async initOneSignal() {
    console.log('initOneSignal called - platform ready');

    // Skip in browser / web environment (ionic serve)
    if (!this.platform.is('hybrid')) {
      console.warn('OneSignal skipped: Not running on native device (browser mode)');
      return;
    }

    try {
      // Initialize OneSignal with your App ID
      await OneSignal.initialize('4c49cb8c-16d6-4d3b-826e-c11fc151bcaf');
      console.log('OneSignal initialized successfully');

      // Request permission (Promise-based, triggers native prompt)
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log('Notification permission granted:', granted);

      if (granted) {
        await this.getAndSendPlayerId();
      } else {
        console.log('Permission denied or not supported');
      }

      // Foreground notification listener
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('Foreground notification received:', event);
        // Optional: Customize or suppress display
        // event.preventDefault();
        // event.getNotification().display();
      });

      // Notification click / open handler
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        console.log('Notification clicked:', event);
        const data = event?.notification?.additionalData || {};

        // Handle deep link or custom action
        if (data?.action === 'open_chat' || data?.type === 'ride_request') {
          console.log('Deep link: opening chat iframe');
          this.loadIframe();
          if (this.chatIframe?.nativeElement) {
            this.chatIframe.nativeElement.contentWindow?.focus?.();
          }
        }
      });
    } catch (error) {
      console.error('Critical error in OneSignal setup:', error);
    }
  }

private async getAndSendPlayerId() {
  try {
    if (!this.platform.is('hybrid')) {
      console.log('Skipping Player ID fetch in browser');
      return;
    }

    console.log('Attempting to fetch Player ID...');

    let playerId: string | null = null;

    // Method 1: Modern v5+ (primary)
    try {
      playerId = await OneSignal.User.getOnesignalId();
      console.log('Method 1 (getOnesignalId) success:', playerId);
    } catch (e) {
      console.warn('Method 1 failed:', e);
    }

    // Method 2: getDeviceState (common alternative)
    if (!playerId) {
      try {
        const deviceState = await OneSignal.User.getDeviceState();
        playerId = deviceState?.userId || null;
        console.log('Method 2 (getDeviceState) success:', playerId);
      } catch (e) {
        console.warn('Method 2 failed:', e);
      }
    }

    // Method 3: Legacy getIds (callback style)
    if (!playerId) {
      try {
        await new Promise<void>((resolve) => {
          OneSignal.getIds((ids: any) => {
            playerId = ids?.userId || null;
            console.log('Method 3 (legacy getIds) success:', playerId);
            resolve();
          });
        });
      } catch (e) {
        console.warn('Method 3 failed:', e);
      }
    }

    // Method 4: Fallback to getDeviceState again (some versions)
    if (!playerId) {
      try {
        const state = await OneSignal.getDeviceState();
        playerId = state?.userId || null;
        console.log('Method 4 fallback success:', playerId);
      } catch (e) {
        console.warn('Method 4 failed:', e);
      }
    }

    if (playerId) {
      console.log('Final Player ID found:', playerId);
      this.sendToBackend(playerId);
    } else {
      console.error('No Player ID found after all attempts');
    }
  } catch (error) {
    console.error('Critical error in getAndSendPlayerId:', error);
  }
}

private sendToBackend(playerId: string) {
  this.http.post('https://quickhelp.com.ng/api/save-device.php', {
    player_id: playerId
  }).subscribe({
    next: (res) => console.log('Player ID saved on server:', res),
    error: (err) => console.error('Failed to save Player ID:', err)
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