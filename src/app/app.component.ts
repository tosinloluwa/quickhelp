import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
@Component({selector:'app-root',templateUrl:'app.component.html',standalone:true,imports:[IonApp,IonRouterOutlet]})
export class AppComponent {
  constructor(platform: Platform) {
    platform.ready().then(()=>{
      // Native splash covers startup only. Network loading has its own cancel/retry UI.
      const splash=(navigator as unknown as {splashscreen?: {hide(): void}}).splashscreen;
      splash?.hide();
    });
  }
}
