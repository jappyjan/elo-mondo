import { describe, expect, it } from 'vitest';
import { isDateInScope } from './timeScope';

const now = new Date('2026-06-08T12:00:00.000Z');

describe('isDateInScope', () => {
  it('includes dates inside the last 30 days', () => {
    expect(isDateInScope('2026-05-20T00:00:00.000Z', { kind: '30d', now })).toBe(true);
  });

  it('excludes dates before the last 30 days', () => {
    expect(isDateInScope('2026-04-01T00:00:00.000Z', { kind: '30d', now })).toBe(false);
  });

  it('filters by calendar year', () => {
    expect(isDateInScope('2025-12-31T23:59:59.000Z', { kind: 'year', year: 2026, now })).toBe(false);
    expect(isDateInScope('2026-01-01T00:00:00.000Z', { kind: 'year', year: 2026, now })).toBe(true);
  });

  it('includes every valid date for all-time scope', () => {
    expect(isDateInScope('2020-01-01T00:00:00.000Z', { kind: 'all', now })).toBe(true);
  });
});
