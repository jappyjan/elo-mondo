import { describe, expect, it } from 'vitest';
import { scopeLabels } from '@/lib/analytics/scopeLabels';

describe('Analytics route shell', () => {
  it('offers recent-form-first time scopes', () => {
    expect(scopeLabels).toEqual({
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      year: 'This year',
      all: 'All time',
    });
  });
});
