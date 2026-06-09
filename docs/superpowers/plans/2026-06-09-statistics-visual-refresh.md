# Statistics Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the four-tab analytics/statistics page with URL-deep-linked state and current-style visual charts/cards.

**Architecture:** Keep `src/pages/Analytics.tsx` as the route shell with shared query-param-backed filters. Add pure URL/view-model helpers under `src/lib/analytics`, reusable visual primitives under `src/components/analytics/shared`, then update each analytics tab to consume the existing analytics data with richer visual layouts.

**Tech Stack:** React 18, TypeScript, React Router search params, Tailwind CSS, shadcn/ui cards/tabs/selects, Recharts, Vitest.

---

## File Structure

- Create: `src/lib/analytics/urlState.ts` parses and updates analytics query params.
- Create: `src/lib/analytics/urlState.test.ts` covers valid/invalid tabs, scopes, years, and selected keys.
- Create: `src/lib/analytics/chartViewModels.ts` builds small pure chart/list view models from existing analytics objects.
- Create: `src/lib/analytics/chartViewModels.test.ts` covers score bucket ordering, throw split, segment popularity, and top mover bars.
- Create: `src/components/analytics/shared/ChartCard.tsx` wraps chart/visual content in existing `Card` styling with empty states.
- Create: `src/components/analytics/shared/StoryStatCard.tsx` renders subtle narrative stats using current colors.
- Create: `src/components/analytics/shared/VisualLeaderboard.tsx` renders ranked rows with proportional bars.
- Create: `src/components/analytics/shared/DistributionBars.tsx` renders simple non-Recharts bar distributions for SSR-safe tests and mobile-friendly visuals.
- Modify: `src/components/analytics/shared/analyticsUiPrimitives.test.tsx` covers the new shared primitives.
- Modify: `src/pages/Analytics.tsx` makes tab, scope, year, selected player, and selected opponent URL-backed, and passes rivalry leaders to Overview.
- Modify: `src/pages/Analytics.test.tsx` adds pure URL-state expectations.
- Modify: `src/components/analytics/AnalyticsOverviewSection.tsx` adds league command-center visuals.
- Modify: `src/components/analytics/PlayerAnalyticsSection.tsx` adds controlled selection and player profile visuals.
- Modify: `src/components/analytics/HeadToHeadSection.tsx` adds controlled selection and rivalry visuals.
- Modify: `src/components/analytics/DartsAnalyticsSection.tsx` adds score, throw, segment, and fun-award visuals.
- Modify: `src/components/analytics/analyticsSections.test.tsx` asserts the new tab landmarks render with existing sample data.

Do not add a new chart dependency. Use existing UI primitives and simple SVG/CSS where that is cleaner than Recharts.

## Task 1: URL-Backed Analytics State

**Files:**
- Create: `src/lib/analytics/urlState.ts`
- Create: `src/lib/analytics/urlState.test.ts`
- Modify: `src/pages/Analytics.tsx`
- Modify: `src/components/analytics/PlayerAnalyticsSection.tsx`
- Modify: `src/components/analytics/HeadToHeadSection.tsx`
- Modify: `src/pages/Analytics.test.tsx`

- [ ] **Step 1: Write failing URL-state tests**

Create `src/lib/analytics/urlState.test.ts` with these tests:

```ts
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

  it('updates search params without dropping unrelated analytics state', () => {
    const params = buildAnalyticsSearch(
      new URLSearchParams('tab=players&scope=90d&player=alice'),
      { tab: 'darts', playerKey: null }
    );

    expect(params.toString()).toBe('tab=darts&scope=90d');
  });
});
```

- [ ] **Step 2: Run the URL-state tests and verify RED**

Run: `npm test -- src/lib/analytics/urlState.test.ts`

Expected: FAIL because `./urlState` does not exist.

- [ ] **Step 3: Implement URL-state helpers**

Create `src/lib/analytics/urlState.ts`:

```ts
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

const tabs: AnalyticsTab[] = ['overview', 'players', 'h2h', 'darts'];
const scopes: TimeScopeKind[] = ['30d', '90d', 'year', 'all'];

function safeYear(availableYears: number[], requestedYear: number, currentYear: number): number {
  if (availableYears.length === 0) return currentYear;
  if (availableYears.includes(requestedYear)) return requestedYear;
  if (availableYears.includes(currentYear)) return currentYear;
  return availableYears[0];
}

export function parseAnalyticsSearch(searchParams: URLSearchParams, availableYears: number[], currentYear: number): AnalyticsUrlState {
  const requestedTab = searchParams.get('tab');
  const requestedScope = searchParams.get('scope');
  const requestedYear = Number(searchParams.get('year'));

  return {
    tab: tabs.includes(requestedTab as AnalyticsTab) ? (requestedTab as AnalyticsTab) : 'overview',
    scopeKind: scopes.includes(requestedScope as TimeScopeKind) ? (requestedScope as TimeScopeKind) : '30d',
    year: safeYear(availableYears, Number.isFinite(requestedYear) ? requestedYear : currentYear, currentYear),
    playerKey: searchParams.get('player'),
    opponentKey: searchParams.get('opponent'),
  };
}

export function buildAnalyticsSearch(searchParams: URLSearchParams, update: AnalyticsSearchUpdate): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (update.tab) next.set('tab', update.tab);
  if (update.scopeKind) next.set('scope', update.scopeKind);
  if (update.year !== undefined) next.set('year', String(update.year));

  if (update.playerKey === null) next.delete('player');
  else if (update.playerKey !== undefined) next.set('player', update.playerKey);

  if (update.opponentKey === null) next.delete('opponent');
  else if (update.opponentKey !== undefined) next.set('opponent', update.opponentKey);

  return next;
}
```

- [ ] **Step 4: Run URL-state tests and verify GREEN**

Run: `npm test -- src/lib/analytics/urlState.test.ts`

Expected: PASS.

- [ ] **Step 5: Make Analytics shell use query params**

Modify `src/pages/Analytics.tsx`:

- Import `useSearchParams` from `react-router-dom`.
- Import `AnalyticsTab`, `buildAnalyticsSearch`, and `parseAnalyticsSearch`.
- Replace `useState` for tab/scope/year with parsed query state.
- Set `Tabs value={urlState.tab}` and update `tab` on `Tabs onValueChange`.
- Set scope/year selects from `urlState` and update search params on change.
- Pass `selectedPlayerKey`, `onSelectedPlayerKeyChange`, `selectedOpponentKey`, and `onSelectedOpponentKeyChange` to tab components.

Use this shape inside `Analytics` before and after `useAnalyticsData` so the fetch does not depend on data that has not loaded yet:

```ts
const [searchParams, setSearchParams] = useSearchParams();
const requestedUrlState = useMemo(
  () => parseAnalyticsSearch(searchParams, [], currentYear),
  [searchParams]
);
const timeScope: AnalyticsTimeScope = useMemo(
  () => ({ kind: requestedUrlState.scopeKind, year: requestedUrlState.year }),
  [requestedUrlState.scopeKind, requestedUrlState.year]
);

const { data, isLoading, isFetching, error } = useAnalyticsData(groupId, timeScope);

const urlState = useMemo(
  () => parseAnalyticsSearch(searchParams, data.availableYears, currentYear),
  [searchParams, data.availableYears]
);

const updateSearch = (update: AnalyticsSearchUpdate) => {
  setSearchParams(buildAnalyticsSearch(searchParams, update), { replace: true });
};
```

If `urlState.year` differs from `requestedUrlState.year` after `data.availableYears` loads and the selected scope is `year`, update the URL with the repaired year. Import `AnalyticsSearchUpdate` from `urlState` for the callback type.

- [ ] **Step 6: Make Players section controllable**

Modify `PlayerAnalyticsSection` props:

```ts
interface PlayerAnalyticsSectionProps {
  players: PlayerMatchStats[];
  darts: ThrowAnalyticsSummary;
  selectedPlayerKey?: string | null;
  onSelectedPlayerKeyChange?: (playerKey: string) => void;
}
```

Resolve selected player in this order: matching `selectedPlayerKey` in filtered players, first filtered player, first player. Call `onSelectedPlayerKeyChange` when the search result changes to a valid selected player and differs from the current query param.

- [ ] **Step 7: Make Head-to-Head section controllable**

Modify `HeadToHeadSection` props:

```ts
interface HeadToHeadSectionProps {
  players: PlayerMatchStats[];
  records: PairwiseRecord[];
  rivalryLeaders: PairwiseRecord[];
  dominanceLeaders: PairwiseRecord[];
  selectedPlayerKey?: string | null;
  selectedOpponentKey?: string | null;
  onSelectedPlayerKeyChange?: (playerKey: string) => void;
  onSelectedOpponentKeyChange?: (opponentKey: string) => void;
}
```

Keep the current existing-record default behavior, but prefer valid query keys. If player and opponent match, select the first valid opponent. When selectors change, call the provided callbacks instead of only local state.

- [ ] **Step 8: Run targeted tests**

Run: `npm test -- src/lib/analytics/urlState.test.ts src/pages/Analytics.test.tsx src/components/analytics/analyticsSections.test.tsx`

Expected: PASS. Existing Radix SSR warnings may remain; do not fix them in this task.

## Task 2: Shared Visual Components And Chart View Models

**Files:**
- Create: `src/lib/analytics/chartViewModels.ts`
- Create: `src/lib/analytics/chartViewModels.test.ts`
- Create: `src/components/analytics/shared/ChartCard.tsx`
- Create: `src/components/analytics/shared/StoryStatCard.tsx`
- Create: `src/components/analytics/shared/VisualLeaderboard.tsx`
- Create: `src/components/analytics/shared/DistributionBars.tsx`
- Modify: `src/components/analytics/shared/analyticsUiPrimitives.test.tsx`

- [ ] **Step 1: Write failing chart view-model tests**

Create `src/lib/analytics/chartViewModels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildScoreDistribution, buildSegmentPopularity, buildThrowTypeSplit, buildTopMoverBars } from './chartViewModels';
import { PlayerMatchStats, PlayerThrowStats } from './types';

const player = (overrides: Partial<PlayerMatchStats>): PlayerMatchStats => ({
  key: 'p1',
  playerId: 'p1',
  playerName: 'Player 1',
  matches: 1,
  wins: 1,
  losses: 0,
  winRate: 1,
  averageFinishRank: 1,
  totalEloChange: 0,
  bestEloGain: 0,
  worstEloLoss: 0,
  recentForm: [],
  placements: [],
  ...overrides,
});

const thrower = (overrides: Partial<PlayerThrowStats>): PlayerThrowStats => ({
  key: 'p1',
  playerId: 'p1',
  playerName: 'Player 1',
  totalDarts: 10,
  totalTurns: 4,
  averageTurnScore: 45,
  averagePointsPerDart: 15,
  missCount: 1,
  missRate: 0.1,
  singles: 4,
  doubles: 2,
  triples: 3,
  bulls: 1,
  t20Count: 2,
  oneCount: 1,
  count100Plus: 1,
  count140Plus: 0,
  count180: 0,
  bestTurn: 120,
  mostCommonSegment: '20',
  mostCommonDart: 'T20',
  mostCommonTurnPattern: 'T20 + S20 + S20',
  ...overrides,
});

describe('analytics chart view models', () => {
  it('builds signed top mover bars sorted by absolute Elo movement', () => {
    const rows = buildTopMoverBars([player({ playerName: 'A', totalEloChange: -20 }), player({ playerName: 'B', totalEloChange: 12 })]);

    expect(rows).toEqual([
      { label: 'A', value: 20, displayValue: '-20', tone: 'warning' },
      { label: 'B', value: 12, displayValue: '+12', tone: 'good' },
    ]);
  });

  it('orders score distribution buckets consistently', () => {
    expect(buildScoreDistribution([{ label: '100-139', count: 2 }, { label: '0-59', count: 5 }, { label: '180', count: 1 }])).toEqual([
      { label: '0-59', value: 5 },
      { label: '100-139', value: 2 },
      { label: '180', value: 1 },
    ]);
  });

  it('builds throw type split from player throw stats', () => {
    expect(buildThrowTypeSplit(thrower({ singles: 4, doubles: 2, triples: 3, bulls: 1, missCount: 1 }))).toEqual([
      { label: 'Singles', value: 4 },
      { label: 'Doubles', value: 2 },
      { label: 'Triples', value: 3 },
      { label: 'Bulls', value: 1 },
      { label: 'Misses', value: 1 },
    ]);
  });

  it('limits segment popularity to the top twenty rows', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ label: String(index + 1), count: 25 - index }));

    expect(buildSegmentPopularity(rows)).toHaveLength(20);
    expect(buildSegmentPopularity(rows)[0]).toEqual({ label: '1', value: 25 });
  });
});
```

- [ ] **Step 2: Run chart view-model tests and verify RED**

Run: `npm test -- src/lib/analytics/chartViewModels.test.ts`

Expected: FAIL because `chartViewModels` does not exist.

- [ ] **Step 3: Implement chart view-model helpers**

Create `src/lib/analytics/chartViewModels.ts`:

```ts
import { CountStat, PlayerMatchStats, PlayerThrowStats } from './types';

export interface BarDatum {
  label: string;
  value: number;
}

export interface ToneBarDatum extends BarDatum {
  displayValue: string;
  tone: 'good' | 'warning' | 'default';
}

const scoreBucketOrder = ['0-59', '60-99', '100-139', '140-179', '180'];

export function buildTopMoverBars(players: PlayerMatchStats[], limit = 6): ToneBarDatum[] {
  return players
    .slice()
    .sort((a, b) => Math.abs(b.totalEloChange) - Math.abs(a.totalEloChange))
    .slice(0, limit)
    .map((player) => ({
      label: player.playerName,
      value: Math.abs(player.totalEloChange),
      displayValue: player.totalEloChange > 0 ? `+${player.totalEloChange}` : String(player.totalEloChange),
      tone: player.totalEloChange > 0 ? 'good' : player.totalEloChange < 0 ? 'warning' : 'default',
    }));
}

export function buildScoreDistribution(rows: CountStat[]): BarDatum[] {
  return rows
    .slice()
    .sort((a, b) => scoreBucketOrder.indexOf(a.label) - scoreBucketOrder.indexOf(b.label))
    .map((row) => ({ label: row.label, value: row.count }));
}

export function buildThrowTypeSplit(player: PlayerThrowStats | null | undefined): BarDatum[] {
  if (!player) return [];
  return [
    { label: 'Singles', value: player.singles },
    { label: 'Doubles', value: player.doubles },
    { label: 'Triples', value: player.triples },
    { label: 'Bulls', value: player.bulls },
    { label: 'Misses', value: player.missCount },
  ];
}

export function buildSegmentPopularity(rows: CountStat[], limit = 20): BarDatum[] {
  return rows.slice(0, limit).map((row) => ({ label: row.label, value: row.count }));
}
```

- [ ] **Step 4: Run chart view-model tests and verify GREEN**

Run: `npm test -- src/lib/analytics/chartViewModels.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing shared primitive tests**

Append tests in `src/components/analytics/shared/analyticsUiPrimitives.test.tsx` for `StoryStatCard`, `VisualLeaderboard`, and `DistributionBars`:

```ts
import { DistributionBars } from './DistributionBars';
import { StoryStatCard } from './StoryStatCard';
import { VisualLeaderboard } from './VisualLeaderboard';

it('renders story stat card title, value, detail, and badge', () => {
  const element = StoryStatCard({ title: 'Hottest form', value: 'Alice', detail: '1st · 2nd', badge: 'Form' });

  expect(collectText(element)).toContain('Hottest form');
  expect(collectText(element)).toContain('Alice');
  expect(collectText(element)).toContain('Form');
});

it('renders visual leaderboard bars with display values', () => {
  const element = VisualLeaderboard({ title: 'Top movers', items: [{ label: 'Alice', value: 24, displayValue: '+24' }] });

  expect(collectText(element)).toContain('Top movers');
  expect(collectText(element)).toContain('Alice');
  expect(collectText(element)).toContain('+24');
});

it('renders distribution bars and empty states', () => {
  const populated = DistributionBars({ items: [{ label: '100-139', value: 2 }] });
  const empty = DistributionBars({ items: [], emptyLabel: 'No score buckets' });

  expect(collectText(populated)).toContain('100-139');
  expect(collectText(empty)).toContain('No score buckets');
});
```

- [ ] **Step 6: Run shared primitive tests and verify RED**

Run: `npm test -- src/components/analytics/shared/analyticsUiPrimitives.test.tsx`

Expected: FAIL because new shared components do not exist.

- [ ] **Step 7: Implement shared visual components**

Create `ChartCard.tsx`, `StoryStatCard.tsx`, `VisualLeaderboard.tsx`, and `DistributionBars.tsx` with current `Card` styling. Keep these components simple and SSR-safe.

`DistributionBars` should calculate max value and set inline width percentages. `VisualLeaderboard` should show rank, label, detail, display value, and a muted/proportional bar. `ChartCard` should render title/description and an empty state when `isEmpty` is true.

- [ ] **Step 8: Run shared primitive tests and full helper tests**

Run: `npm test -- src/lib/analytics/chartViewModels.test.ts src/components/analytics/shared/analyticsUiPrimitives.test.tsx`

Expected: PASS.

## Task 3: Overview And Players Visual Refresh

**Files:**
- Modify: `src/components/analytics/AnalyticsOverviewSection.tsx`
- Modify: `src/pages/Analytics.tsx`
- Modify: `src/components/analytics/PlayerAnalyticsSection.tsx`
- Modify: `src/components/analytics/analyticsSections.test.tsx`

- [ ] **Step 1: Write failing section tests for new Overview/Players landmarks**

Update `analyticsSections.test.tsx` so the Overview test also expects:

```ts
expect(html).toContain('League momentum');
expect(html).toContain('Score distribution');
expect(html).toContain('Hottest form');
```

Update the Overview render call in the test to pass `rivalryLeaders={records}`.

Update the Players test to expect:

```ts
expect(html).toContain('Player profile');
expect(html).toContain('Placement distribution');
expect(html).toContain('Throw type split');
expect(html).toContain('Recent form');
```

- [ ] **Step 2: Run section tests and verify RED**

Run: `npm test -- src/components/analytics/analyticsSections.test.tsx`

Expected: FAIL because the new visual landmarks do not render yet.

- [ ] **Step 3: Refresh Overview section**

Modify `AnalyticsOverviewSection.tsx`:

- Import `ChartCard`, `StoryStatCard`, `VisualLeaderboard`, `DistributionBars`.
- Import `buildScoreDistribution` and `buildTopMoverBars`.
- Add a `rivalryLeaders: PairwiseRecord[]` prop and update `src/pages/Analytics.tsx` to pass `data.headToHead.rivalryLeaders`.
- Keep existing metric card rows.
- Add a top grid with `ChartCard title="League momentum"` containing `VisualLeaderboard` for top movers.
- Add `ChartCard title="Score distribution"` containing `DistributionBars` from `darts.scoreDistribution`.
- Add story cards for hottest form, most improved, biggest Elo gain, and top rivalry from `rivalryLeaders[0]` with a `No rivalry data` fallback.
- Keep existing leaderboards below the new visual row.

- [ ] **Step 4: Refresh Players section**

Modify `PlayerAnalyticsSection.tsx`:

- Keep the search input.
- Render a `ChartCard title="Player profile"` hero with selected player name, win rate, Elo change, matches, and recent form pills.
- Render `ChartCard title="Placement distribution"` with `DistributionBars` from `selected.placements`.
- Render `ChartCard title="Throw type split"` with `DistributionBars` from `buildThrowTypeSplit(dartStats)`.
- Keep existing exact-count leaderboards below the visual row.

- [ ] **Step 5: Run Overview/Players section tests and verify GREEN**

Run: `npm test -- src/components/analytics/analyticsSections.test.tsx`

Expected: PASS with existing Radix SSR warnings only.

## Task 4: Head-To-Head And Darts Visual Refresh

**Files:**
- Modify: `src/components/analytics/HeadToHeadSection.tsx`
- Modify: `src/components/analytics/DartsAnalyticsSection.tsx`
- Modify: `src/components/analytics/analyticsSections.test.tsx`

- [ ] **Step 1: Write failing section tests for new Head-to-Head/Darts landmarks**

Update the Head-to-Head test to expect:

```ts
expect(html).toContain('Rivalry snapshot');
expect(html).toContain('Win-rate split');
expect(html).toContain('Recent meetings');
```

Update the Darts test to expect:

```ts
expect(html).toContain('Score distribution');
expect(html).toContain('Throw type split');
expect(html).toContain('Segment popularity');
expect(html).toContain('Fun awards');
```

Ensure the sample `darts.scoreDistribution` includes at least one row, for example `{ label: '100-139', count: 3 }`.

- [ ] **Step 2: Run section tests and verify RED**

Run: `npm test -- src/components/analytics/analyticsSections.test.tsx`

Expected: FAIL because the new landmarks do not render yet.

- [ ] **Step 3: Refresh Head-to-Head section**

Modify `HeadToHeadSection.tsx`:

- Keep player/opponent selects.
- Add `ChartCard title="Rivalry snapshot"` showing selected names, record, meetings, win rate, and Elo movement.
- Add `ChartCard title="Win-rate split"` with `DistributionBars` rows for selected wins and losses.
- Add `ChartCard title="Recent meetings"` showing the last five meetings as compact rows; if no meetings, show `No meetings in this period`.
- Keep most-played and dominance leaderboards below the new cards.

- [ ] **Step 4: Refresh Darts section**

Modify `DartsAnalyticsSection.tsx`:

- Keep the empty state when `darts.totalDarts === 0`.
- Add `ChartCard title="Score distribution"` with `DistributionBars` from `buildScoreDistribution(darts.scoreDistribution)`.
- Add `ChartCard title="Throw type split"` using aggregate totals from `darts.playerStats` or the top player if aggregate helper is not added.
- Add `ChartCard title="Segment popularity"` with `VisualLeaderboard` from `buildSegmentPopularity(darts.segments)`.
- Rename the fun section heading from `Fun stats` to `Fun awards` while keeping existing award leaderboards.
- Keep existing serious leaderboards below the visual cards.

- [ ] **Step 5: Run Head-to-Head/Darts tests and verify GREEN**

Run: `npm test -- src/components/analytics/analyticsSections.test.tsx`

Expected: PASS with existing Radix SSR warnings only.

## Task 5: Full Verification And Polish

**Files:**
- Review all modified files from Tasks 1-4.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS. Existing Vite deprecation warnings and Radix SSR warnings may remain if they were present before the change.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS and produce the Vite `dist` build output.

- [ ] **Step 3: Inspect git diff**

Run: `git diff --stat` and `git diff -- src/pages/Analytics.tsx src/components/analytics src/lib/analytics`

Expected: Diff only includes analytics URL state, chart helpers, shared analytics visual components, section visual refreshes, and tests. No package-lock churn should remain.

- [ ] **Step 4: Manual deep-link smoke checks**

Start the app with `npm run dev` and verify these URLs in a browser:

```text
?tab=overview&scope=30d
?tab=players&scope=90d&player=<valid-player-key>
?tab=h2h&scope=year&year=<valid-year>&player=<valid-player-key>&opponent=<valid-opponent-key>
?tab=darts&scope=all
```

Expected: reload preserves tab/filter/selection and invalid player/opponent params fall back safely.
