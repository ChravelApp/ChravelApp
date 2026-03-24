import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushNotificationsMock = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  checkPermissions: vi.fn(),
  addListener: vi.fn(),
  register: vi.fn(),
  removeAllListeners: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  removeAllDeliveredNotifications: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    isPluginAvailable: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: pushNotificationsMock,
}));

import { checkPermissions, requestPermissions } from '../push';

describe('native push expo bridge compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.ChravelNative = { isNative: true, platform: 'ios', version: '1.0.0' };
  });

  it('uses bridge-native permission API in Expo WebView mode', async () => {
    const permissionEvent = {
      receive: 'granted',
    };

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const requestPromise = requestPermissions();
    const listener = addEventListenerSpy.mock.calls.find(
      ([name]) => name === 'chravel:push-permission',
    )?.[1] as EventListener | undefined;

    expect(listener).toBeDefined();

    listener?.(new CustomEvent('chravel:push-permission', { detail: permissionEvent }));
    await expect(requestPromise).resolves.toBe('granted');

    expect(pushNotificationsMock.requestPermissions).not.toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });

  it('uses bridge-native permission check API in Expo WebView mode', async () => {
    const permissionEvent = {
      receive: 'denied',
    };

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    const checkPromise = checkPermissions();
    const listener = addEventListenerSpy.mock.calls.find(
      ([name]) => name === 'chravel:push-permission',
    )?.[1] as EventListener | undefined;

    expect(listener).toBeDefined();
    listener?.(new CustomEvent('chravel:push-permission', { detail: permissionEvent }));

    await expect(checkPromise).resolves.toBe('denied');
    expect(pushNotificationsMock.checkPermissions).not.toHaveBeenCalled();
  });
});
