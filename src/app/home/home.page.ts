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
      this.checkSiteV2('https://api.github.com/repos/tosinloluwa/quickhelp/releases/latest').then(info => {
        this.isLoaded = true;
        this.isLoading = false;
        this.errorMessage = null;
      }).catch(err => {
        this.errorMessage = 'Unable to load chat. Please check your internet connection.';
        this.isLoading = false;
      });
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

  async checkSiteAvailability() {
    console.log('Checking site availability...');
    this.isLoading = true;
    this.isLoaded = false;
    this.errorMessage = null;

    try {
      // Use fetch with a timeout to check site availability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
      const response = await fetch('https://quickhelp.com.ng/chat.php', {
        method: 'HEAD', // Lightweight request
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        this.isLoaded = true;
        this.isLoading = false;
      } else {
        this.errorMessage = 'Unable to load chat. Please try again.';
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Site availability check failed:', error);
      this.errorMessage = 'Unable to load chat. Please check your internet connection.';
      this.isLoading = false;
    }
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
