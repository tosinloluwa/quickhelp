interface OneSignalStatic {
  initialize(appId: string): void;
  Notifications: {
    requestPermission(callback: (granted: boolean) => void): void;
    addEventListener(event: 'foregroundWillDisplay' | 'click', callback: (event: any) => void): void;
    // Add more methods if you use them later
  };
  User: {
    getOnesignalId(): Promise<string | null>;
  };
}

interface Window {
  OneSignal: OneSignalStatic;
}