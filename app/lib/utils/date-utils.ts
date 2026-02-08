/**
 * Egypt timezone helpers.
 * Egypt is UTC+2 year-round (no daylight saving since 2014).
 */

const EGYPT_TZ = 'Africa/Cairo'

/**
 * Convert a Date to a YYYY-MM-DD string in Egypt local time.
 * Use this instead of `date.toISOString().split('T')[0]` which uses UTC.
 */
export function toEgyptDateString(date: Date): string {
  // Intl guarantees correct offset even if Egypt ever re-introduces DST
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EGYPT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return `${year}-${month}-${day}`
}

/**
 * Get the hour (0-23) in Egypt local time.
 * Use this instead of `date.getHours()` which uses the server/browser timezone.
 */
export function toEgyptHour(date: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TZ,
    hour: 'numeric',
    hour12: false,
  }).format(date)

  return parseInt(hourStr, 10)
}

/**
 * Get the day of week (0=Sunday, 6=Saturday) in Egypt local time.
 * Use this instead of `date.getDay()` which uses the server/browser timezone.
 */
export function toEgyptDayOfWeek(date: Date): number {
  // Create a date string in Egypt timezone, then parse it to get the day
  const egyptDateStr = toEgyptDateString(date)
  // Parse YYYY-MM-DD parts to construct a date at noon to avoid any edge issues
  const [y, m, d] = egyptDateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
