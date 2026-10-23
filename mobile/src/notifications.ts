import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { registerDevice } from './api';

/**
 * Notification system.
 *
 * The backend's proactive scheduler queues AppNotification rows whenever a
 * character texts first. This module polls them and fires LOCAL notifications
 * — no Firebase/FCM needed, which suits the LAN-only backend.
 *
 * Two polling paths share pollAndNotify():
 *  - a background task (expo-background-task, ~15 min cadence, app closed)
 *  - a foreground interval in the authed layout (fast, app open)
 *
 * The poll authenticates with a long-lived device token instead of a Clerk
 * JWT, because Clerk tokens are short-lived and unavailable in headless JS.
 * IMPORTANT: this file must be imported from the app entry (index.js) so
 * TaskManager.defineTask runs when Android launches the bundle headless.
 */

const DEVICE_TOKEN_KEY = 'sluxa.deviceToken';
const SERVER_URL_KEY = 'sluxa.serverUrl';
const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.101:8000';

const POLL_TASK = 'sluxa-notification-poll';
const CHANNEL_ID = 'messages';

export interface PushedNotification {
  id: number;
  kind: 'dm' | 'group' | 'friend' | 'friend_request';
  chat_id: number;
  title: string;
  body: string;
  created_at: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Poll the backend for undelivered notifications and present them.
 * Headless-safe: reads server URL + device token straight from AsyncStorage
 * and uses bare axios (no Clerk). Returns how many were shown.
 */
export async function pollAndNotify(): Promise<number> {
  const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) return 0;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  const base = (stored || DEFAULT_URL).replace(/\/+$/, '');

  const res = await axios.post(
    `${base}/api/notifications/poll`,
    { token },
    { timeout: 25000 },
  );
  const notifs: PushedNotification[] = res.data?.notifications ?? [];

  for (const n of notifs) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: n.title,
        body: n.body,
        data: { kind: n.kind, chatId: n.chat_id },
      },
      // channelId-only trigger presents immediately on our channel
      trigger:
        Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  }
  return notifs.length;
}

// Must be at module scope so it's defined during headless launches.
TaskManager.defineTask(POLL_TASK, async () => {
  try {
    await pollAndNotify();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Full setup — call once from the authed layout (needs a Clerk session for
 * device registration). Safe to call repeatedly.
 */
export async function setupNotifications(): Promise<void> {
  // Channel must exist BEFORE the Android 13 permission prompt can appear.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }

  // Register (or refresh) the long-lived device token used by the poller.
  const existing = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  const res = await registerDevice(existing, Platform.OS);
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, res.data.token);

  try {
    await BackgroundTask.registerTaskAsync(POLL_TASK, { minimumInterval: 15 });
  } catch (e) {
    // Background task unavailable (e.g., iOS simulator) — foreground polling
    // still works.
    console.warn('[notifications] background task registration failed', e);
  }
}

/** Route for a tapped notification, or null. */
export function notificationTarget(data: unknown): string | null {
  const d = data as { kind?: string; chatId?: number } | null;
  if (!d?.chatId) return null;
  if (d.kind === 'dm') return `/(app)/chat/${d.chatId}`;
  if (d.kind === 'group') return `/(app)/group-chat/${d.chatId}`;
  if (d.kind === 'friend') return `/(app)/friend-chat/${d.chatId}`;
  if (d.kind === 'friend_request') return `/(app)/(tabs)/friends`;
  return null;
}
