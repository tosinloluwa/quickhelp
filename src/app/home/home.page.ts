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

  constructor(private platform: Platform) {}

  ngOnInit() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  loadIframe() {
    if (navigator.onLine) {
      this.isIframeActive = true;
      this.isOffline = false;
    } else {
      this.isOffline = true;
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

  handleNetworkChange(isOnline: boolean) {
    this.isOffline = !isOnline;
    if (this.isIframeActive && !isOnline) {
      this.isIframeActive = false;
    }
  }

  retryConnection() {
    this.loadIframe();
    if (this.chatIframe && navigator.onLine) {
      this.chatIframe.nativeElement.src = 'https://quickhelp.com.ng/chat.php';
    }
  }
}
