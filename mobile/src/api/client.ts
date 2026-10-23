import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * API client with a runtime-configurable base URL (Profile → Server URL)
 * and Clerk token injection on every request.
 */

const SERVER_URL_KEY = 'sluxa.serverUrl';
const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.101:8000';

let baseUrl = DEFAULT_URL;
let tokenGetter: (() => Promise<string | null>) | null = null;

// Group-chat turns can involve many sequential Gemini calls.
export const api = axios.create({ timeout: 180000 });

api.interceptors.request.use(async (config) => {
  config.baseURL = `${baseUrl.replace(/\/+$/, '')}/api`;
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // Request proceeds unauthenticated; backend returns 401 and UI surfaces it.
    }
  }
  return config;
});

/** Wire Clerk's getToken into the client (called from the authed layout). */
export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  tokenGetter = fn;
}

/** Load persisted server URL override; call once at startup. */
export async function loadServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (stored) baseUrl = stored;
  } catch {
    // fall back to default
  }
  return baseUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  baseUrl = clean || DEFAULT_URL;
  if (clean) await AsyncStorage.setItem(SERVER_URL_KEY, clean);
  else await AsyncStorage.removeItem(SERVER_URL_KEY);
}

export function getServerUrl(): string {
  return baseUrl;
}

export function getDefaultServerUrl(): string {
  return DEFAULT_URL;
}

/** Human-readable message out of an axios/fetch error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (err.code === 'ECONNABORTED') return 'Request timed out — the server took too long.';
    if (!err.response) {
      return `Can't reach the server at ${baseUrl}. Check that the backend is running and the Server URL in Profile is correct.`;
    }
    return `${fallback} (HTTP ${err.response.status})`;
  }
  return fallback;
}
