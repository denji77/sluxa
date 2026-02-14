/**
 * Local time utility — uses the client's system clock directly.
 * No external API needed: browsers sync via NTP and are accurate enough.
 */

const _timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * Get the user's IANA timezone string (e.g. "America/New_York").
 */
export function getTimezone() {
  return _timezone
}

/**
 * Always considered synced (browser clock is the source of truth).
 */
export function isSynced() {
  return true
}

/**
 * Format the current time for display (e.g. "2:30 PM").
 */
export function getFormattedTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get time context to send to the backend for AI awareness.
 */
export function getTimeContext() {
  const now = new Date()
  return {
    timezone: _timezone,
    local_time: now.toISOString(),
    formatted_time: now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    formatted_date: now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}
