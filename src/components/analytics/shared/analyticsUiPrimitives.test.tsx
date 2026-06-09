import { isValidElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { MetricCard } from './MetricCard';
import { SimpleLeaderboard } from './SimpleLeaderboard';

function collectText(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (isValidElement<{ children?: ReactNode }>(node)) return collectText(node.props.children);
  return [];
}

function collectClasses(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [];
  if (Array.isArray(node)) return node.flatMap(collectClasses);
  if (isValidElement<{ className?: string; children?: ReactNode }>(node)) {
    return [node.props.className ?? '', ...collectClasses(node.props.children)].filter(Boolean);
  }
  return [];
}

describe('analytics UI primitives', () => {
  it('renders a metric card label, value, detail, and tone class', () => {
    const element = MetricCard({ label: 'Win rate', value: '67%', detail: 'Last 30 days', tone: 'good' });

    expect(collectText(element)).toEqual(['Win rate', '67%', 'Last 30 days']);
    expect(collectClasses(element).join(' ')).toContain('text-green-600');
  });

  it('renders a consistent empty state message', () => {
    const element = AnalyticsEmptyState({ title: 'No games yet', description: 'Play a match to unlock analytics.' });

    expect(collectText(element)).toEqual(['No games yet', 'Play a match to unlock analytics.']);
  });

  it('limits leaderboard output to the top ten rows and supports empty labels', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      label: `Player ${index + 1}`,
      value: index + 1,
      detail: `${index + 1} matches`,
    }));

    const populated = SimpleLeaderboard({ title: 'Most active', description: 'By games played', items });
    const empty = SimpleLeaderboard({ title: 'No darts', items: [], emptyLabel: 'No throws tracked' });

    expect(collectText(populated)).toContain('Most active');
    expect(collectText(populated)).toContain('Player 10');
    expect(collectText(populated)).not.toContain('Player 11');
    expect(collectText(empty)).toContain('No throws tracked');
  });
});
