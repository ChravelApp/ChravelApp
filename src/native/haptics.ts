/**
 * Native Haptics Wrapper (Capacitor)
 *
 * Requirements:
 * - Must NOT run on web (hard-gated behind native detection).
 * - Exposes small UX-mapped helpers: light/medium/heavy + success/warning/error.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getNativeRuntime, postToNative } from './bridge';

/**
 * Returns true only when running inside a Capacitor native shell AND the
 * Haptics plugin is available.
 */
export function isNativeHaptics(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics');
}

async function safeRun(fn: () => Promise<void>, bridgeStyle?: string): Promise<void> {
  const runtime = getNativeRuntime();

  // Expo WebView: send haptic request via bridge.
  if (runtime === 'expo-webview' && bridgeStyle) {
    postToNative({ type: 'haptic', style: bridgeStyle });
    return;
  }

  // Capacitor: use native plugin.
  if (!isNativeHaptics()) return;

  try {
    await fn();
  } catch (error) {
    // Non-blocking: haptics should never crash UX flows.
    if (import.meta.env.DEV) {
      console.warn('[Haptics] Failed to trigger haptic:', error);
    }
  }
}

export async function light(): Promise<void> {
  await safeRun(() => Haptics.impact({ style: ImpactStyle.Light }), 'light');
}

export async function medium(): Promise<void> {
  await safeRun(() => Haptics.impact({ style: ImpactStyle.Medium }), 'medium');
}

export async function heavy(): Promise<void> {
  await safeRun(() => Haptics.impact({ style: ImpactStyle.Heavy }), 'heavy');
}

export async function success(): Promise<void> {
  await safeRun(() => Haptics.notification({ type: NotificationType.Success }), 'success');
}

export async function warning(): Promise<void> {
  await safeRun(() => Haptics.notification({ type: NotificationType.Warning }), 'warning');
}

export async function error(): Promise<void> {
  await safeRun(() => Haptics.notification({ type: NotificationType.Error }), 'error');
}

/**
 * Selection changed haptic - iOS selection feedback
 * Used for picker changes, list selection, etc.
 */
export async function selectionChanged(): Promise<void> {
  await safeRun(() => Haptics.selectionChanged());
}

/**
 * Vibrate - Simple vibration for attention
 * Fallback for devices without taptic engine
 */
export async function vibrate(duration: number = 300): Promise<void> {
  await safeRun(() => Haptics.vibrate({ duration }));
}
