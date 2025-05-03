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
  isLoading: boolean = true;
  errorMessage: string | null = null;
  isOnline: boolean = navigator.onLine;

  constructor() {}

  ngOnInit(): void {
    // Monitor network status
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));

    // Stop loading after 5 seconds if iframe doesn't load
    setTimeout(() => {
      if (this.isLoading && this.isOnline) {
        this.isLoading = false;
        this.errorMessage = 'Unable to load chat. Please try again.';
      }
    }, 5000);
  }

  updateOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.isLoading = isOnline; // Show spinner when going online
    this.errorMessage = null;
  }

  onIframeLoad(): void {
    console.log('Iframe loaded successfully');
    this.isLoading = false;
    this.errorMessage = null;
  }

  onIframeError(): void {
    console.log('Iframe failed to load');
    this.isLoading = false;
    this.errorMessage = 'Unable to load chat. Please check your internet connection.';
  }

  retryConnection(): void {
    this.isOnline = navigator.onLine;
    if (this.isOnline) {
      this.isLoading = true;
      this.errorMessage = null;
      // Reset iframe by reloading the page
      window.location.reload();
    }
  }
}
