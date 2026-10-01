import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i=l.indexOf('='); return [l.slice(0,i),l.slice(i+1).split(' #')[0].trim().replace(/^"|"$/g,'')]; }));
const client = new ConvexHttpClient(env.VITE_CONVEX_URL);
const groupId = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd';
function normalize(result) {
  return {
    players: result.players.slice().sort((a,b) => a.playerId.localeCompare(b.playerId)).map(({daysSinceLastMatch, ...p}) => p),
    history: result.matchHistory.map(m => ({ ...m, matchDate: new Date(m.matchDate).toISOString(), results: m.results.slice().sort((a,b) => a.playerId.localeCompare(b.playerId)) })).sort((a,b) => a.matchId.localeCompare(b.matchId)),
    availableYears: result.availableYears,
  };
}
for (const year of [2025,2026]) {
  const params={groupId, year, applyDecay:false, includeProvisional:true};
  const response=await fetch('https://stzilnijaoxwqyuyryts.supabase.co/functions/v1/calculate-elo', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(params) });
  if(!response.ok) throw new Error('Supabase Elo comparison request failed');
  const original=await response.json();
  const migrated=await client.query(api.data.elo,params);
  try { assert.deepEqual(JSON.parse(JSON.stringify(normalize(migrated))),JSON.parse(JSON.stringify(normalize(original)))); } catch { throw new Error(`Elo parity failed for ${year}; investigate before cutover.`); }
  console.log(`Elo parity ${year}: ${migrated.players.length} players, ${migrated.matchHistory.length} matches; every rating and historical result matches Supabase.`);
}
