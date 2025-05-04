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
      this.isLoading = true;
      this.isOffline = false;
      this.isLoaded = true; // Show iframe immediately
    } else {
      this.handleOffline();
    }
  }

  onIframeLoad() {
    console.log('Iframe loaded successfully');
    this.isLoading = false;
    this.isLoaded = true;
    this.isOffline = false;
  }

  onIframeError() {
    console.log('Iframe failed to load');
    this.handleOffline();
  }

  handleOffline() {
    this.isLoading = false;
    this.isLoaded = false;
    this.isOffline = true;
  }

  handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      this.isOffline = false;
      this.isLoaded = true; // Show iframe
      this.isLoading = true; // Trigger loading state while iframe reloads
      if (this.chatIframe) {
        this.chatIframe.nativeElement.src = this.chatIframe.nativeElement.src; // Reload iframe
      }
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
