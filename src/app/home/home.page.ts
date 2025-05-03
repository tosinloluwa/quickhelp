import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon, IonToggle } from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon, IonToggle],
})
export class HomePage implements OnInit {
  isLoading: boolean = false;
  errorMessage: string | null = null;
  isOnline: boolean = navigator.onLine;
  isChatEnabled: boolean = true;
  isWebsiteAvailable: boolean = false;

  constructor() {}

  ngOnInit(): void {
    // Monitor network status
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));

    // Check website availability if online and chat enabled
    if (this.isOnline && this.isChatEnabled) {
      this.checkWebsiteAvailability();
    }
  }

  updateOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.isLoading = false;
    this.errorMessage = null;
    if (this.isOnline && this.isChatEnabled) {
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
    }, 5000); // 5-second timeout

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

  onToggleChange(): void {
    console.log('Chat toggle changed:', this.isChatEnabled);
    if (this.isChatEnabled && this.isOnline) {
      this.checkWebsiteAvailability();
    } else {
      this.isWebsiteAvailable = false;
      this.isLoading = false;
      this.errorMessage = null;
    }
  }

  retryConnection(): void {
    this.isOnline = navigator.onLine;
    if (this.isOnline && this.isChatEnabled) {
      this.checkWebsiteAvailability();
    }
  }
}
