import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText],
})
export class HomePage implements OnInit {
  isLoading = true;
  isLoaded = false;
  showIframe = false;
  errorMessage: string | null = null;
  isOffline = false;

  constructor(private platform: Platform) {}

  ngOnInit() {
    this.checkSiteAvailability();
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  checkSiteAvailability() {
    console.log('Checking site availability...');
    if (!navigator.onLine) {
      this.handleOffline();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = 'https://quickhelp.com.ng/chat.php';
    iframe.style.display = 'none';

    iframe.onload = () => {
      console.log('Iframe loaded successfully');
      this.isLoaded = true;
      this.isLoading = false;
      this.isOffline = false;
      document.body.removeChild(iframe);
    };

    iframe.onerror = () => {
      console.log('Iframe failed to load');
      this.handleOffline();
      document.body.removeChild(iframe);
    };

    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 5000);
  }

  handleOffline() {
    this.isOffline = true;
    this.isLoading = false;
    this.errorMessage = null;
    this.showIframe = false;
  }

  handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      this.isOffline = false;
      this.checkSiteAvailability();
    } else {
      this.handleOffline();
    }
  }

  showChat() {
    if (!navigator.onLine) {
      this.handleOffline();
      return;
    }
    this.showIframe = true;
    this.errorMessage = null;
  }

  retryConnection() {
    this.isLoading = true;
    this.isOffline = false;
    this.checkSiteAvailability();
  }

  exitApp() {
    if (this.platform.is('cordova')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).app.exitApp();
    } else {
      console.log('Exit app not supported in this environment');
    }
  }
}
