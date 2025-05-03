import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, IonText, IonIcon],
})
export class HomePage implements OnInit {
  isLoading = false;
  isLoaded = false;
  showIframe = false;
  errorMessage: string | null = null;
  isOnline = navigator.onLine;

  constructor() {}

  ngOnInit() {
    // Monitor network status
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    if (this.isOnline) {
      this.checkSiteAvailability();
    }
  }

  updateOnlineStatus(isOnline: boolean) {
    this.isOnline = isOnline;
    this.isLoading = false;
    this.showIframe = false;
    this.errorMessage = null;
    if (this.isOnline) {
      this.checkSiteAvailability();
    }
  }

  checkSiteAvailability() {
    console.log('Checking site availability...');
    this.isLoading = true;
    const iframe = document.createElement('iframe');
    iframe.src = 'https://quickhelp.com.ng/chat.php';
    iframe.style.display = 'none';

    iframe.onload = () => {
      console.log('Iframe loaded successfully');
      this.isLoaded = true;
      this.isLoading = false;
    };

    iframe.onerror = () => {
      console.log('Iframe failed to load');
      this.errorMessage = 'Unable to load chat. Please check your internet connection.';
      this.isLoading = false;
    };

    document.body.appendChild(iframe);
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 5000);
  }

  showChat() {
    this.showIframe = true;
    this.errorMessage = null;
  }

  retryConnection() {
    this.isOnline = navigator.onLine;
    if (this.isOnline) {
      this.checkSiteAvailability();
    }
  }
}
