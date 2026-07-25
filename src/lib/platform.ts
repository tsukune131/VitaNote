import { Capacitor } from '@capacitor/core';

/** Capacitorのネイティブアプリとして動いているか(WebやPWAならfalse) */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
