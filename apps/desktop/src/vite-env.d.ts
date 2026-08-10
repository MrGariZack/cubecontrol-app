/// <reference types="vite/client" />

import type { ToneHubDesktopApi } from "../electron/preload";

declare global {
  interface Window {
    readonly tonehubDesktop: ToneHubDesktopApi;
  }
}

export {};
