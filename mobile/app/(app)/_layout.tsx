import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as Notifications from 'expo-notifications';
import { setTokenGetter } from '../../src/api/client';
import {
  notificationTarget,
  pollAndNotify,
  setupNotifications,
} from '../../src/notifications';
import { colors } from '../../src/theme';

// Survives remounts: don't re-handle the launch notification.
let coldStartHandled = false;

/** Authenticated area: guards routes and wires Clerk tokens into the API client. */
export default function AppLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const setupDoneRef = useRef(false);

  useEffect(() => {
    // Clerk caches tokens internally and refreshes them on demand, so
    // fetching per-request keeps the Authorization header always fresh.
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);

  // Notification setup needs an authed session (device registration).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || setupDoneRef.current) return;
    setupDoneRef.current = true;
    setupNotifications().catch((e) =>
      console.warn('[notifications] setup failed', e),
    );
  }, [isLoaded, isSignedIn]);

  // Foreground polling: the background task only runs ~every 15 min, so
  // poll faster while the app is open / returns to the foreground.
  useEffect(() => {
    if (!isSignedIn) return;
    const poll = () => pollAndNotify().catch(() => {});
    const interval = setInterval(poll, 60000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });
    poll();
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isSignedIn]);

  // Tapping a notification opens the chat it came from.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const target = notificationTarget(resp.notification.request.content.data);
      if (target) router.push(target as never);
    });
    if (!coldStartHandled) {
      coldStartHandled = true;
      Notifications.getLastNotificationResponseAsync().then((resp) => {
        if (!resp) return;
        const target = notificationTarget(resp.notification.request.content.data);
        if (target) router.push(target as never);
      });
    }
    return () => sub.remove();
  }, [router]);

  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
