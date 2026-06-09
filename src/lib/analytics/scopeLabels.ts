import { TimeScopeKind } from './types';

export const scopeLabels: Record<TimeScopeKind, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  year: 'This year',
  all: 'All time',
};
