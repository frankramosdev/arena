/**
 * Date Utilities
 *
 * Helpers for time-aware market generation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DateContext {
  now: Date;
  endOfToday: Date;
  tomorrow: Date;
  endOfWeek: Date;
  dayOfWeek: string;
  timeOfDay: string;
  hoursLeftToday: number;
  daysLeftInWeek: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get human-readable time of day
 */
export function getTimeOfDay(hour: number): string {
  if (hour < 6) return "early morning";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

/**
 * Get end of day for a given date
 */
export function getEndOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Get days until Sunday from a given date
 */
export function getDaysUntilSunday(date: Date): number {
  return 7 - date.getDay();
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get comprehensive date context for time-aware prompts
 *
 * @example
 * const ctx = getDateContext();
 * console.log(ctx.dayOfWeek);      // "Saturday"
 * console.log(ctx.hoursLeftToday); // 8
 */
export function getDateContext(): DateContext {
  const now = new Date();

  const endOfToday = getEndOfDay(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfTomorrow = getEndOfDay(tomorrow);

  const daysUntilSunday = getDaysUntilSunday(now);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  const endOfWeekDate = getEndOfDay(endOfWeek);

  return {
    now,
    endOfToday,
    tomorrow: endOfTomorrow,
    endOfWeek: endOfWeekDate,
    dayOfWeek: DAY_NAMES[now.getDay()],
    timeOfDay: getTimeOfDay(now.getHours()),
    hoursLeftToday: Math.floor((endOfToday.getTime() - now.getTime()) / (1000 * 60 * 60)),
    daysLeftInWeek: daysUntilSunday,
  };
}

