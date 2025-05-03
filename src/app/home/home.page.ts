import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon, IonButtons } from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon, IonButtons],
})
export class HomePage implements OnInit {
  isLoading: boolean = false;
  errorMessage: string | null = null;
  isOnline: boolean = navigator.onLine;
  isWebsiteAvailable: boolean = false;

  constructor() {}

  ngOnInit(): void {
    // Monitor network status
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));

    // Initial network check
    this.checkNetworkStatus();

    // Periodic network check every 10 seconds
    setInterval(() => {
      if (!this.isOnline) {
        this.checkNetworkStatus();
      }
    }, 10000);
  }

  async checkNetworkStatus(): Promise<void> {
    console.log('Checking network status...');
    this.isOnline = navigator.onLine;

    if (!this.isOnline) {
      this.isWebsiteAvailable = false;
      this.isLoading = false;
      this.errorMessage = null;
      return;
    }

    // Fallback network check with fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      this.isOnline = true;
    } catch (error) {
      console.log('Network check failed:', error);
      this.isOnline = false;
    }

    if (this.isOnline) {
      this.checkWebsiteAvailability();
    } else {
      this.isWebsiteAvailable = false;
      this.isLoading = false;
      this.errorMessage = null;
    }
  }

  updateOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.isLoading = false;
    this.errorMessage = null;
    if (this.isOnline) {
      this.checkWebsiteAvailability();
    } else {
      this.isWebsiteAvailable = false;
    }
  }

  checkWebsiteAvailability(): void {
    console.log('Checking website availability...');
    this.isLoading = true;
    this.isWebsiteAvailable = false;
    this.errorMessage = null;

    const iframe: HTMLIFrameElement = document.createElement('iframe');
    iframe.src = 'https://quickhelp.com.ng/chat.php';
    iframe.style.display = 'none';

    const timeoutId = setTimeout(() => {
      if (!this.isWebsiteAvailable) {
        console.log('Website check timed out');
        this.isLoading = false;
        this.isWebsiteAvailable = false;
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }
    }, 5000);

    iframe.onload = () => {
      console.log('Website loaded successfully');
      clearTimeout(timeoutId);
      this.isWebsiteAvailable = true;
      this.isLoading = false;
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    iframe.onerror = () => {
      console.log('Website failed to load');
      clearTimeout(timeoutId);
      this.isWebsiteAvailable = false;
      this.isLoading = false;
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    document.body.appendChild(iframe);
  }

  onIframeLoad(): void {
    console.log('Iframe loaded successfully');
    this.isLoading = false;
    this.errorMessage = null;
    this.isWebsiteAvailable = true;
  }

  onIframeError(): void {
    console.log('Iframe failed to load');
    this.isLoading = false;
    this.errorMessage = 'Unable to load chat. Please check your internet connection.';
    this.isWebsiteAvailable = false;
  }

  retryConnection(): void {
    this.checkNetworkStatus();
  }

  closeApp(): void {
    console.log('Closing app...');
    if ((navigator as any).app && (navigator as any).app.exitApp) {
      (navigator as any).app.exitApp();
    } else {
      console.log('Exit not supported in this environment');
      window.close(); // Fallback for browser
    }
  }
}
