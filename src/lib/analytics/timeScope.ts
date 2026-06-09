import { AnalyticsTimeScope } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function getNow(scope: AnalyticsTimeScope): Date {
  return scope.now ?? new Date();
}

export function getScopeStart(scope: AnalyticsTimeScope): Date | null {
  const now = getNow(scope);

  if (scope.kind === '30d') return new Date(now.getTime() - 30 * DAY_MS);
  if (scope.kind === '90d') return new Date(now.getTime() - 90 * DAY_MS);
  if (scope.kind === 'year') return new Date(Date.UTC(scope.year ?? now.getUTCFullYear(), 0, 1));
  return null;
}

export function getScopeEnd(scope: AnalyticsTimeScope): Date | null {
  const now = getNow(scope);

  if (scope.kind === 'year') return new Date(Date.UTC(scope.year ?? now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
  return null;
}

export function isDateInScope(dateValue: string | null | undefined, scope: AnalyticsTimeScope): boolean {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const start = getScopeStart(scope);
  const end = getScopeEnd(scope);

  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

export function filterByScope<T>(items: T[], getDate: (item: T) => string | null | undefined, scope: AnalyticsTimeScope): T[] {
  return items.filter((item) => isDateInScope(getDate(item), scope));
}
