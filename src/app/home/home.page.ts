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
  isLoading: boolean = true;
  showIframe: boolean = false;
  isOnline: boolean = navigator.onLine;

  constructor() {}

  ngOnInit(): void {
    console.log('ngOnInit: isOnline =', this.isOnline);
    // Monitor network status
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    // Force initial content after a short delay
    setTimeout(() => {
      this.isLoading = false;
      console.log('Initial loading complete: isOnline =', this.isOnline);
    }, 2000); // 2-second initial delay
  }

  updateOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
    this.isLoading = false;
    this.showIframe = false;
    console.log('Network status updated: isOnline =', this.isOnline);
  }

  showChat(): void {
    this.showIframe = true;
    console.log('showChat: Showing iframe');
  }

  retryConnection(): void {
    this.isOnline = navigator.onLine;
    this.isLoading = true;
    console.log('retryConnection: isOnline =', this.isOnline);
    setTimeout(() => {
      this.isLoading = false;
      console.log('Retry loading complete: isOnline =', this.isOnline);
    }, 2000); // 2-second retry delay
  }

  closeApp(): void {
    console.log('closeApp: Attempting to close app');
    if ((window as any).navigator && (window as any).navigator.app) {
      (window as any).navigator.app.exitApp();
    } else {
      console.log('closeApp: Not in Cordova environment');
      window.alert('App close is only supported on mobile devices.');
    }
  }
}
