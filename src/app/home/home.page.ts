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
  isLoaded: boolean = false;
  showIframe: boolean = false;
  errorMessage: string | null = null;
  isOnline: boolean = navigator.onLine;

  constructor() {}

  ngOnInit(): void {
    // Monitor network status
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    if (this.isOnline) {
      this.checkSiteAvailability();
    }
  }

  updateOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.isLoading = false;
    this.showIframe = false;
    this.errorMessage = null;
    if (this.isOnline) {
      this.checkSiteAvailability();
    }
  }

  checkSiteAvailability(): void {
    console.log('Checking site availability...');
    this.isLoading = true;
    this.isLoaded = false;
    this.errorMessage = null;

    const iframe: HTMLIFrameElement = document.createElement('iframe');
    iframe.src = 'https://quickhelp.com.ng/chat.php';
    iframe.style.display = 'none';

    const timeoutId = setTimeout(() => {
      if (!this.isLoaded) {
        console.log('Iframe check timed out');
        this.errorMessage = 'Unable to load chat. Please check your internet connection.';
        this.isLoading = false;
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }
    }, 5000); // 5-second timeout

    iframe.onload = () => {
      console.log('Iframe loaded successfully');
      clearTimeout(timeoutId);
      this.isLoaded = true;
      this.isLoading = false;
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    iframe.onerror = () => {
      console.log('Iframe failed to load');
      clearTimeout(timeoutId);
      this.errorMessage = 'Unable to load chat. Please check your internet connection.';
      this.isLoading = false;
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    document.body.appendChild(iframe);
  }

  showChat(): void {
    this.showIframe = true;
    this.errorMessage = null;
  }

  retryConnection(): void {
    this.isOnline = navigator.onLine;
    if (this.isOnline) {
      this.checkSiteAvailability();
    }
  }

  closeApp(): void {
    // Check if running in Cordova environment
    if ((window as any).navigator && (window as any).navigator.app) {
      (window as any).navigator.app.exitApp();
    } else {
      console.log('App close not supported in browser');
      // Optional: Alert for browser testing
      window.alert('App close is only supported on mobile devices.');
    }
  }
}
