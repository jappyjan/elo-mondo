import { TimeScopeKind } from './types';

export type AnalyticsTab = 'overview' | 'players' | 'h2h' | 'darts';

export interface AnalyticsUrlState {
  tab: AnalyticsTab;
  scopeKind: TimeScopeKind;
  year: number;
  playerKey: string | null;
  opponentKey: string | null;
}

export interface AnalyticsSearchUpdate {
  tab?: AnalyticsTab;
  scopeKind?: TimeScopeKind;
  year?: number;
  playerKey?: string | null;
  opponentKey?: string | null;
}

const tabs = new Set<AnalyticsTab>(['overview', 'players', 'h2h', 'darts']);
const scopes = new Set<TimeScopeKind>(['30d', '90d', 'year', 'all']);

function getYear(searchParams: URLSearchParams, availableYears: number[], currentYear: number) {
  const yearParam = searchParams.get('year');
  const parsedYear = yearParam === null ? NaN : Number(yearParam);

  if (Number.isInteger(parsedYear) && (availableYears.length === 0 || availableYears.includes(parsedYear))) {
    return parsedYear;
  }

  if (availableYears.includes(currentYear)) {
    return currentYear;
  }

  return availableYears[0] ?? currentYear;
}

export function parseAnalyticsSearch(
  searchParams: URLSearchParams,
  availableYears: number[],
  currentYear: number
): AnalyticsUrlState {
  const tab = searchParams.get('tab');
  const scope = searchParams.get('scope');

  return {
    tab: tabs.has(tab as AnalyticsTab) ? (tab as AnalyticsTab) : 'overview',
    scopeKind: scopes.has(scope as TimeScopeKind) ? (scope as TimeScopeKind) : '30d',
    year: getYear(searchParams, availableYears, currentYear),
    playerKey: searchParams.get('player'),
    opponentKey: searchParams.get('opponent'),
  };
}

export function buildAnalyticsSearch(searchParams: URLSearchParams, update: AnalyticsSearchUpdate): URLSearchParams {
  const nextParams = new URLSearchParams(searchParams);

  if (update.tab !== undefined) {
    nextParams.set('tab', update.tab);
  }

  if (update.scopeKind !== undefined) {
    nextParams.set('scope', update.scopeKind);
  }

  if (update.year !== undefined) {
    nextParams.set('year', String(update.year));
  }

  if (update.playerKey !== undefined) {
    if (update.playerKey === null) {
      nextParams.delete('player');
    } else {
      nextParams.set('player', update.playerKey);
    }
  }

  if (update.opponentKey !== undefined) {
    if (update.opponentKey === null) {
      nextParams.delete('opponent');
    } else {
      nextParams.set('opponent', update.opponentKey);
    }
  }

  return nextParams;
}
