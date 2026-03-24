/**
 * Native Bridge Adapter
 *
 * Detects the native runtime (Capacitor, Expo WebView, or plain browser)
 * and provides helpers for communicating with the Expo native shell.
 *
 * The Expo shell injects `window.ChravelNative` before page load and
 * listens for messages via `window.ReactNativeWebView.postMessage()`.
 */

export type NativeRuntime = 'capacitor' | 'expo-webview' | 'web';

interface ChravelNativeGlobal {
  platform: string;
  isNative: boolean;
  version: string;
}

interface ReactNativeWebViewGlobal {
  postMessage: (message: string) => void;
}

declare global {
  interface Window {
    ChravelNative?: ChravelNativeGlobal;
    ReactNativeWebView?: ReactNativeWebViewGlobal;
  }
}

/**
 * Detect which native runtime the web app is running inside.
 */
export function getNativeRuntime(): NativeRuntime {
  if (typeof window === 'undefined') return 'web';

  // Check Expo WebView first — it's more specific.
  if (window.ChravelNative?.isNative) return 'expo-webview';

  // Check Capacitor.
  try {
    // Dynamic import check to avoid bundling issues.
    const cap = (window as Record<string, unknown>).Capacitor as
      | { isNativePlatform?: () => boolean }
      | undefined;
    if (cap?.isNativePlatform?.()) return 'capacitor';
  } catch {
    // Capacitor not available.
  }

  return 'web';
}

/**
 * Returns true if running inside any native shell (Capacitor or Expo).
 */
export function isNativeApp(): boolean {
  return getNativeRuntime() !== 'web';
}

/**
 * Returns true if running inside the Expo WebView shell.
 */
export function isExpoWebView(): boolean {
  return getNativeRuntime() === 'expo-webview';
}

/**
 * Send a typed message to the Expo native shell.
 * No-ops if not running inside the Expo WebView.
 */
export function postToNative(message: Record<string, unknown>): void {
  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
}

/**
 * Listen for a custom event dispatched by the Expo native shell.
 * Returns an unsubscribe function.
 *
 * The native shell sends events via:
 *   webView.injectJavaScript(`window.dispatchEvent(new CustomEvent('name', { detail }))`)
 */
export function onNativeEvent<T = unknown>(
  eventName: string,
  callback: (detail: T) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<T>).detail;
    callback(detail);
  };

  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}

/**
 * Signal to the Expo native shell that the web app is ready.
 * Call after auth hydration completes.
 */
export function signalReady(): void {
  postToNative({ type: 'ready' });
}
