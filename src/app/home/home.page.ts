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
  isOffline = false;

  constructor(private platform: Platform) {}

  ngOnInit() {
    this.checkConnectivity();
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  checkConnectivity() {
    if (navigator.onLine) {
      this.loadIframe();
    } else {
      this.handleOffline();
    }
  }

  loadIframe() {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://quickhelp.com.ng/chat.php';
    iframe.style.display = 'none';

    iframe.onload = () => {
      console.log('Iframe loaded successfully');
      this.isLoading = false;
      this.isLoaded = true;
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
    this.isLoading = false;
    this.isLoaded = false;
    this.isOffline = true;
  }

  handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      this.isOffline = false;
      this.loadIframe();
    } else {
      this.handleOffline();
    }
  }

  retryConnection() {
    this.isLoading = true;
    this.isOffline = false;
    this.checkConnectivity();
  }
}
