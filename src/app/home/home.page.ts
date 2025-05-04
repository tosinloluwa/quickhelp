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
  isOffline = !navigator.onLine; // Set initial offline state

  constructor(private platform: Platform) {}

  ngOnInit() {
    this.checkConnectivity();
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  checkConnectivity() {
    this.isLoading = navigator.onLine;
    this.isOffline = !navigator.onLine;
    if (navigator.onLine) {
      this.isLoaded = true; // Show iframe immediately
    } else {
      this.isLoading = false; // Stop loading spinner if offline
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
    this.isLoading = false;
    this.isLoaded = false;
    this.isOffline = true;
  }

  handleNetworkChange(isOnline: boolean) {
    this.isOffline = !isOnline;
    if (isOnline) {
      this.isLoading = true;
      this.isLoaded = true; // Show iframe
      if (this.chatIframe) {
        this.chatIframe.nativeElement.src = this.chatIframe.nativeElement.src; // Reload iframe
      }
    } else {
      this.isLoading = false;
      this.isLoaded = false;
    }
  }

  retryConnection() {
    this.isLoading = true;
    this.isOffline = false;
    this.checkConnectivity();
    if (this.chatIframe && navigator.onLine) {
      this.chatIframe.nativeElement.src = 'https://quickhelp.com.ng/chat.php'; // Force reload
    }
  }
}
