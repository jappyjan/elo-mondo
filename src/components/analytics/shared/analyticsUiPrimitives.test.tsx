import { CSSProperties, isValidElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { DistributionBars } from './DistributionBars';
import { MetricCard } from './MetricCard';
import { SimpleLeaderboard } from './SimpleLeaderboard';
import { StoryStatCard } from './StoryStatCard';
import { VisualLeaderboard } from './VisualLeaderboard';

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

function collectWidths(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [];
  if (Array.isArray(node)) return node.flatMap(collectWidths);
  if (isValidElement<{ children?: ReactNode; style?: CSSProperties }>(node)) {
    const width = typeof node.props.style?.width === 'string' ? [node.props.style.width] : [];
    return [...width, ...collectWidths(node.props.children)];
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

  it('renders story stat card title, value, detail, and badge', () => {
    const element = StoryStatCard({ title: 'Hottest form', value: 'Alice', detail: '1st · 2nd', badge: 'Form' });

    expect(collectText(element)).toContain('Hottest form');
    expect(collectText(element)).toContain('Alice');
    expect(collectText(element)).toContain('Form');
  });

  it('renders visual leaderboard bars with display values', () => {
    const element = VisualLeaderboard({
      title: 'Top movers',
      items: [{ label: 'Alice', value: 24, displayValue: '+24' }],
    });

    expect(collectText(element)).toContain('Top movers');
    expect(collectText(element)).toContain('Alice');
    expect(collectText(element)).toContain('+24');
  });

  it('renders visual leaderboard bars with safe widths for invalid values', () => {
    const element = VisualLeaderboard({
      title: 'Top movers',
      items: [
        { label: 'Zero', value: 0 },
        { label: 'Negative', value: -5 },
        { label: 'NaN', value: Number.NaN },
        { label: 'Infinity', value: Infinity },
        { label: 'Positive', value: 10 },
      ],
    });

    expect(collectWidths(element)).toEqual(['0%', '0%', '0%', '0%', '100%']);
  });

  it('renders distribution bars and empty states', () => {
    const populated = DistributionBars({ items: [{ label: '100-139', value: 2 }] });
    const empty = DistributionBars({ items: [], emptyLabel: 'No score buckets' });

    expect(collectText(populated)).toContain('100-139');
    expect(collectText(empty)).toContain('No score buckets');
  });

  it('renders distribution bars with safe widths for zero, negative, NaN, and Infinity values', () => {
    const element = DistributionBars({
      items: [
        { label: 'Zero', value: 0 },
        { label: 'Negative', value: -1 },
        { label: 'NaN', value: Number.NaN },
        { label: 'Infinity', value: Infinity },
        { label: 'Positive', value: 4 },
      ],
    });

    expect(collectWidths(element)).toEqual(['0%', '0%', '0%', '0%', '100%']);
  });
});
