/**
 * Auto-registers for push notifications after login.
 *
 * Mount this component inside the authenticated app layout.
 * It registers once per session — if the user has already granted
 * permission, it silently re-registers to keep the token fresh.
 * If permission hasn't been requested yet, it prompts the user.
 *
 * Works with both Capacitor and Expo WebView via the bridge adapter.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isNativePush, register, checkPermissions } from '@/native/push';
import { saveDeviceToken } from '@/services/pushTokenService';
import { isNativeApp } from '@/native/bridge';

export function PushRegistration(): null {
  const { user } = useAuth();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!user || hasRegistered.current) return;
    if (!isNativePush() && !isNativeApp()) return;

    const attemptRegistration = async () => {
      // Check if permission was already granted (returning user).
      const permission = await checkPermissions();

      if (permission === 'granted') {
        // Re-register silently to refresh the token.
        const result = await register();
        if (result.token) {
          await saveDeviceToken(user.id, result.token);
          hasRegistered.current = true;
        }
      }
      // If permission is 'prompt', don't auto-prompt — let the user
      // opt in via the notification settings UI. Apple rejects apps
      // that prompt for push on first launch without context.
    };

    attemptRegistration();
  }, [user]);

  return null;
}
