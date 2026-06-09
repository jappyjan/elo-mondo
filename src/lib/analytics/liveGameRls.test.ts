import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsSql = readdirSync(join(process.cwd(), 'supabase', 'migrations'))
  .map((file) => readFileSync(join(process.cwd(), 'supabase', 'migrations', file), 'utf8'))
  .join('\n');

describe('live game analytics RLS', () => {
  it('allows public analytics to read completed live-game dart data', () => {
    expect(migrationsSql).toContain('Anyone can view completed live games');
    expect(migrationsSql).toContain('Anyone can view completed live game players');
    expect(migrationsSql).toContain('Anyone can view completed game throws');
    expect(migrationsSql).toMatch(/ON public\.live_games[\s\S]*FOR SELECT[\s\S]*USING \(status = 'completed'\)/);
    expect(migrationsSql).toMatch(/ON public\.live_game_players[\s\S]*lg\.status = 'completed'/);
    expect(migrationsSql).toMatch(/ON public\.game_throws[\s\S]*lg\.status = 'completed'/);
  });
});
