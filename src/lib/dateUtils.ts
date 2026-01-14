import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, getWeek, startOfWeek, endOfWeek, addDays, subDays, isBefore, isAfter, isSameDay } from 'date-fns';

// Curaçao timezone - hardcoded (AST, UTC-4, no DST)
export const CURACAO_TIMEZONE = 'America/Curacao';

/**
 * Get current date/time in Curaçao timezone
 */
export function nowCuracao(): Date {
  return toZonedTime(new Date(), CURACAO_TIMEZONE);
}

/**
 * Get today's date at midnight in Curaçao timezone
 */
export function todayCuracao(): Date {
  return startOfDay(nowCuracao());
}

/**
 * Parse a date string (YYYY-MM-DD) as Curaçao local date at midnight
 */
export function parseDateCuracao(dateString: string): Date {
  // Create date in Curaçao timezone at midnight
  const [year, month, day] = dateString.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 4, 0, 0)); // UTC-4 means add 4 hours to get midnight in Curaçao
  return toZonedTime(utcDate, CURACAO_TIMEZONE);
}

/**
 * Format a date for display in Curaçao timezone
 */
export function formatCuracao(date: Date | string, formatStr: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, CURACAO_TIMEZONE, formatStr);
}

/**
 * Get today's date as YYYY-MM-DD string in Curaçao
 */
export function todayStringCuracao(): string {
  return formatCuracao(new Date(), 'yyyy-MM-dd');
}

/**
 * Get current week number in Curaçao timezone
 */
export function weekNumberCuracao(): number {
  return getWeek(nowCuracao());
}

/**
 * Get start of current week in Curaçao timezone
 */
export function startOfWeekCuracao(date?: Date): Date {
  const d = date || nowCuracao();
  return startOfWeek(d, { weekStartsOn: 1 }); // Monday start
}

/**
 * Get end of current week in Curaçao timezone
 */
export function endOfWeekCuracao(date?: Date): Date {
  const d = date || nowCuracao();
  return endOfWeek(d, { weekStartsOn: 1 }); // Monday start
}

/**
 * Add days to a date
 */
export function addDaysCuracao(date: Date, days: number): Date {
  return addDays(date, days);
}

/**
 * Subtract days from a date
 */
export function subDaysCuracao(date: Date, days: number): Date {
  return subDays(date, days);
}

/**
 * Check if a date is before another date (Curaçao timezone aware)
 */
export function isBeforeCuracao(date: Date | string, dateToCompare: Date | string): boolean {
  const d1 = typeof date === 'string' ? parseDateCuracao(date) : date;
  const d2 = typeof dateToCompare === 'string' ? parseDateCuracao(dateToCompare) : dateToCompare;
  return isBefore(startOfDay(d1), startOfDay(d2));
}

/**
 * Check if a date is after another date (Curaçao timezone aware)
 */
export function isAfterCuracao(date: Date | string, dateToCompare: Date | string): boolean {
  const d1 = typeof date === 'string' ? parseDateCuracao(date) : date;
  const d2 = typeof dateToCompare === 'string' ? parseDateCuracao(dateToCompare) : dateToCompare;
  return isAfter(startOfDay(d1), startOfDay(d2));
}

/**
 * Check if two dates are the same day (Curaçao timezone aware)
 */
export function isSameDayCuracao(date: Date | string, dateToCompare: Date | string): boolean {
  const d1 = typeof date === 'string' ? parseDateCuracao(date) : date;
  const d2 = typeof dateToCompare === 'string' ? parseDateCuracao(dateToCompare) : dateToCompare;
  return isSameDay(d1, d2);
}

/**
 * Check if a date string is in the past compared to today in Curaçao
 */
export function isPastCuracao(dateString: string): boolean {
  return isBeforeCuracao(dateString, todayCuracao());
}

/**
 * Check if a date string is today in Curaçao
 */
export function isTodayCuracao(dateString: string): boolean {
  return isSameDayCuracao(dateString, todayCuracao());
}

/**
 * Convert a Curaçao local time to ISO string for database storage
 */
export function toISOCuracao(date: Date): string {
  return fromZonedTime(date, CURACAO_TIMEZONE).toISOString();
}

/**
 * Get day of week (0 = Sunday, 1 = Monday, etc.) in Curaçao timezone
 */
export function getDayOfWeekCuracao(date?: Date | string): number {
  if (!date) return nowCuracao().getDay();
  const d = typeof date === 'string' ? parseDateCuracao(date) : date;
  return d.getDay();
}

/**
 * Format date string to YYYY-MM-DD in Curaçao timezone
 */
export function toDateStringCuracao(date: Date): string {
  return formatCuracao(date, 'yyyy-MM-dd');
}
