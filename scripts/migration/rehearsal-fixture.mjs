import { execFileSync } from 'node:child_process';
const now='2026-10-01T00:00:00.000Z';
const run=(fn,args)=>execFileSync('npx',['convex','run',fn,JSON.stringify(args)],{stdio:'pipe'});
run('migration:importAccounts',{rows:[{legacyId:'migration-rehearsal',email:'migration-rehearsal@elomondo.invalid',name:'Migration QA',disabled:false}]});
for(const [table,rows] of Object.entries({
  groups:[{id:'migration-rehearsal-group',name:'Migration rehearsal (temporary)',created_by:'migration-rehearsal',created_at:now}],
  players:[{id:'migration-rehearsal-player',name:'Migration QA',user_id:'migration-rehearsal',created_at:now,updated_at:now},{id:'migration-rehearsal-guest',name:'Migration QA guest',user_id:null,created_at:now,updated_at:now}],
  group_members:[{id:'migration-rehearsal-membership',group_id:'migration-rehearsal-group',player_id:'migration-rehearsal-player',role:'admin',joined_at:now}],
}))run('migration:importBatch',{batch:{table,rows}});
console.log('Synthetic development account and isolated rehearsal group ready.');
