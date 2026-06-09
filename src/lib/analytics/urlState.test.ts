import { describe, expect, it } from 'vitest';
import { buildAnalyticsSearch, parseAnalyticsSearch } from './urlState';

describe('analytics URL state', () => {
  it('defaults missing params to overview and recent scope', () => {
    expect(parseAnalyticsSearch(new URLSearchParams(), [2026], 2026)).toEqual({
      tab: 'overview',
      scopeKind: '30d',
      year: 2026,
      playerKey: null,
      opponentKey: null,
    });
  });

  it('keeps valid tab, scope, year, and nested selections', () => {
    const params = new URLSearchParams('tab=h2h&scope=year&year=2025&player=alice&opponent=bob');

    expect(parseAnalyticsSearch(params, [2026, 2025], 2026)).toEqual({
      tab: 'h2h',
      scopeKind: 'year',
      year: 2025,
      playerKey: 'alice',
      opponentKey: 'bob',
    });
  });

  it('repairs invalid tab, scope, and year params', () => {
    const params = new URLSearchParams('tab=bad&scope=bad&year=1900');

    expect(parseAnalyticsSearch(params, [2024], 2026)).toEqual({
      tab: 'overview',
      scopeKind: '30d',
      year: 2024,
      playerKey: null,
      opponentKey: null,
    });
  });

  it('keeps a numeric requested year before available years load', () => {
    const params = new URLSearchParams('scope=year&year=2025');

    expect(parseAnalyticsSearch(params, [], 2026)).toEqual({
      tab: 'overview',
      scopeKind: 'year',
      year: 2025,
      playerKey: null,
      opponentKey: null,
    });
  });

  it('defaults missing year to current year before available years load', () => {
    const params = new URLSearchParams('scope=year');

    expect(parseAnalyticsSearch(params, [], 2026)).toEqual({
      tab: 'overview',
      scopeKind: 'year',
      year: 2026,
      playerKey: null,
      opponentKey: null,
    });
  });

  it('updates search params without dropping unrelated analytics state', () => {
    const params = buildAnalyticsSearch(
      new URLSearchParams('tab=players&scope=90d&player=alice'),
      { tab: 'darts', playerKey: null }
    );

    expect(params.toString()).toBe('tab=darts&scope=90d');
  });
});
