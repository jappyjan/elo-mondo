import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i=l.indexOf('='); return [l.slice(0,i),l.slice(i+1).split(' #')[0].trim().replace(/^"|"$/g,'')]; }));
const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--prod', '--decay'].includes(arg))) throw new Error('Supported options: --prod, --decay');
const client = new ConvexHttpClient(args.has('--prod') ? 'https://strong-parakeet-869.eu-west-1.convex.cloud' : env.VITE_CONVEX_URL);
const applyDecay = args.has('--decay');
const groupId = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd';
function normalize(result) {
  return {
    // With decay enabled, output ratings depend on each request's millisecond.
    // Compare every historical result and raw rating; check rounded output below.
    players: result.players.slice().sort((a,b) => a.playerId.localeCompare(b.playerId)).map(({daysSinceLastMatch, ...p}) => {
      if (!applyDecay) return p;
      const { currentElo, decayApplied, rank, ...stable } = p;
      return stable;
    }),
    history: result.matchHistory.map(m => ({ ...m, matchDate: new Date(m.matchDate).toISOString(), results: m.results.slice().sort((a,b) => a.playerId.localeCompare(b.playerId)) })).sort((a,b) => a.matchId.localeCompare(b.matchId)),
    availableYears: result.availableYears,
  };
}
for (const year of [2025,2026]) {
  const params={groupId, year, applyDecay, includeProvisional:true};
  const response=await fetch('https://stzilnijaoxwqyuyryts.supabase.co/functions/v1/calculate-elo', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(params) });
  if(!response.ok) throw new Error('Supabase Elo comparison request failed');
  const original=await response.json();
  const migrated=await client.query(api.data.elo,params);
  try { assert.deepEqual(JSON.parse(JSON.stringify(normalize(migrated))),JSON.parse(JSON.stringify(normalize(original)))); } catch { throw new Error(`Elo parity failed for ${year}; investigate before cutover.`); }
  if (applyDecay) {
    for (const player of migrated.players) {
      const source = original.players.find(p => p.playerId === player.playerId);
      assert.ok(Math.abs(player.currentElo - source.currentElo) <= 1, 'Time-dependent output rating differs by more than rounding');
      assert.ok(Math.abs(player.decayApplied - source.decayApplied) <= 1, 'Time-dependent decay differs by more than rounding');
    }
  }
  console.log(`Elo parity ${year} (decay ${applyDecay ? 'on' : 'off'}): ${migrated.players.length} players, ${migrated.matchHistory.length} matches; every raw rating and historical result matches Supabase.`);
}
