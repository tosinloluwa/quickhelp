import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('chatIframe', { static: false }) chatIframe!: ElementRef<HTMLIFrameElement>;
  isIframeActive = false;
  isOffline = !navigator.onLine;
  isOnline = navigator.onLine;

  constructor(private platform: Platform) {}

  ngOnInit() {
    this.updateConnectivityStatus();
    window.addEventListener('online', () => this.updateConnectivityStatus());
    window.addEventListener('offline', () => this.updateConnectivityStatus());

    // Continuously check connectivity every 5 seconds
    setInterval(() => this.updateConnectivityStatus(), 5000);
  }

  updateConnectivityStatus() {
    const wasOffline = this.isOffline;
    this.isOnline = navigator.onLine;
    this.isOffline = !this.isOnline;

    if (!this.isOnline && this.isIframeActive) {
      this.isIframeActive = false; // Reset to landing page if offline
    } else if (this.isOnline && wasOffline && this.isIframeActive) {
      this.isIframeActive = false; // Reset to landing page on reconnect
    }
  }

  loadIframe() {
    if (this.isOnline) {
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
  }

  retryConnection() {
    this.isIframeActive = false; // Reset to landing page
    this.updateConnectivityStatus();
  }
}
