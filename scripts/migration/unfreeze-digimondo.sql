-- Rollback only: export/reconcile new Convex writes before reopening Supabase.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$
DECLARE entity text;
BEGIN
  FOREACH entity IN ARRAY ARRAY[
    'public.groups', 'public.group_members', 'public.group_invites',
    'public.group_invite_codes', 'public.players', 'public.matches',
    'public.match_participants', 'public.live_games', 'public.live_game_players',
    'public.game_throws', 'auth.users', 'auth.identities', 'auth.mfa_factors'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS elo_digimondo_freeze_row ON %s', entity);
    EXECUTE format('DROP TRIGGER IF EXISTS elo_digimondo_freeze_truncate ON %s', entity);
  END LOOP;
END $$;
DROP SCHEMA IF EXISTS elo_migration_cutover CASCADE;
COMMIT;
