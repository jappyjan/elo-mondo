-- Run explicitly with Supabase administrative access, after validation is ready.
-- All source writes touching DIGIMONDO's closure are rejected, including old
-- clients with still-valid JWTs. Reads and unrelated groups remain available.
-- PostgreSQL trigger semantics: https://www.postgresql.org/docs/17/sql-createtrigger.html
-- Roll back with unfreeze-digimondo.sql ONLY after addressing new Convex writes.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Drain pre-existing writers before capturing the protected closure and adding
-- guards. The locks and guards take effect in one transaction.
LOCK TABLE public.groups, public.group_members, public.group_invites,
  public.group_invite_codes, public.players, public.matches,
  public.match_participants, public.live_games, public.live_game_players,
  public.game_throws, auth.users, auth.identities, auth.mfa_factors
  IN SHARE ROW EXCLUSIVE MODE;

CREATE SCHEMA elo_migration_cutover;
REVOKE ALL ON SCHEMA elo_migration_cutover FROM PUBLIC;
CREATE TABLE elo_migration_cutover.state (
  group_id uuid PRIMARY KEY,
  frozen_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE elo_migration_cutover.scope (
  entity text NOT NULL,
  id text NOT NULL,
  PRIMARY KEY (entity, id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA elo_migration_cutover FROM PUBLIC;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.groups
      WHERE id = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd'
        AND upper(name) = 'DIGIMONDO') THEN
    RAISE EXCEPTION 'Expected DIGIMONDO group is missing';
  END IF;
END $$;

INSERT INTO elo_migration_cutover.state (group_id)
VALUES ('8195d6b6-f5a5-455d-a9d6-a8adf37970cd');

WITH g AS (
  SELECT * FROM public.groups WHERE id = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd'
), members AS (
  SELECT * FROM public.group_members WHERE group_id IN (SELECT id FROM g)
), matches AS (
  SELECT * FROM public.matches WHERE group_id IN (SELECT id FROM g)
), participants AS (
  SELECT * FROM public.match_participants WHERE match_id IN (SELECT id FROM matches)
), games AS (
  SELECT * FROM public.live_games WHERE group_id IN (SELECT id FROM g)
), game_players AS (
  SELECT * FROM public.live_game_players WHERE game_id IN (SELECT id FROM games)
), players AS (
  SELECT * FROM public.players WHERE id IN (
    SELECT player_id FROM members
    UNION SELECT winner_id FROM matches
    UNION SELECT loser_id FROM matches
    UNION SELECT player_id FROM participants
    UNION SELECT player_id FROM game_players WHERE player_id IS NOT NULL
  )
), invites AS (
  SELECT * FROM public.group_invites WHERE group_id IN (SELECT id FROM g)
), users AS (
  SELECT * FROM auth.users WHERE id IN (
    SELECT user_id FROM players WHERE user_id IS NOT NULL
    UNION SELECT created_by FROM g WHERE created_by IS NOT NULL
    UNION SELECT created_by FROM games
    UNION SELECT invited_by FROM invites WHERE invited_by IS NOT NULL
  )
)
INSERT INTO elo_migration_cutover.scope (entity, id)
SELECT 'public.groups', id::text FROM g
UNION ALL SELECT 'public.group_members', id::text FROM members
UNION ALL SELECT 'public.matches', id::text FROM matches
UNION ALL SELECT 'public.match_participants', id::text FROM participants
UNION ALL SELECT 'public.live_games', id::text FROM games
UNION ALL SELECT 'public.live_game_players', id::text FROM game_players
UNION ALL SELECT 'public.players', id::text FROM players
UNION ALL SELECT 'public.group_invites', id::text FROM invites
UNION ALL SELECT 'public.group_invite_codes', id::text FROM public.group_invite_codes WHERE group_id IN (SELECT id FROM g)
UNION ALL SELECT 'public.game_throws', id::text FROM public.game_throws WHERE game_id IN (SELECT id FROM games)
UNION ALL SELECT 'auth.users', id::text FROM users
UNION ALL SELECT 'auth.identities', id::text FROM auth.identities WHERE user_id IN (SELECT id FROM users)
UNION ALL SELECT 'auth.mfa_factors', id::text FROM auth.mfa_factors WHERE user_id IN (SELECT id FROM users);

CREATE FUNCTION elo_migration_cutover.guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE row_data jsonb;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'DIGIMONDO migration: source writes are frozen';
  END IF;
  FOREACH row_data IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  ] LOOP
    IF row_data IS NULL THEN CONTINUE; END IF;
    IF row_data->>'group_id' = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd'
      OR (TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'groups'
          AND row_data->>'id' = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd')
      OR EXISTS (SELECT 1 FROM elo_migration_cutover.scope s
        WHERE (s.entity = TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME AND s.id = row_data->>'id')
          OR (s.entity = 'public.matches' AND s.id = row_data->>'match_id')
          OR (s.entity = 'public.live_games' AND s.id = row_data->>'game_id')
          OR (s.entity = 'public.live_game_players' AND s.id = row_data->>'game_player_id')
          OR (s.entity = 'auth.users' AND s.id = row_data->>'user_id')
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'DIGIMONDO migration: source writes are frozen';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION elo_migration_cutover.guard() FROM PUBLIC;

DO $$
DECLARE target_entity text; schema_name text; table_name text; sample_id text; operation text; insert_columns text;
BEGIN
  FOREACH target_entity IN ARRAY ARRAY[
    'public.groups', 'public.group_members', 'public.group_invites',
    'public.group_invite_codes', 'public.players', 'public.matches',
    'public.match_participants', 'public.live_games', 'public.live_game_players',
    'public.game_throws', 'auth.users', 'auth.identities', 'auth.mfa_factors'
  ] LOOP
    schema_name := split_part(target_entity, '.', 1);
    table_name := split_part(target_entity, '.', 2);
    EXECUTE format('CREATE TRIGGER elo_digimondo_freeze_row BEFORE INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION elo_migration_cutover.guard()', schema_name, table_name);
    -- Supabase's managed auth tables allow CREATE TRIGGER but reserve ALTER
    -- TABLE to their owner. Normal triggers still guard GoTrue/auth writes.
    IF schema_name = 'public' THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ALWAYS TRIGGER elo_digimondo_freeze_row', schema_name, table_name);
    END IF;
    EXECUTE format('CREATE TRIGGER elo_digimondo_freeze_truncate BEFORE TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION elo_migration_cutover.guard()', schema_name, table_name);
    IF schema_name = 'public' THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ALWAYS TRIGGER elo_digimondo_freeze_truncate', schema_name, table_name);
    END IF;
    SELECT id INTO sample_id FROM elo_migration_cutover.scope s WHERE s.entity = target_entity LIMIT 1;
    IF sample_id IS NOT NULL THEN
      FOREACH operation IN ARRAY ARRAY['insert', 'update', 'delete'] LOOP
        BEGIN
          -- Every operation must fail with our maintenance error. A
          -- subtransaction undoes unexpected success before aborting setup.
          IF operation = 'insert' THEN
            SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum)
              INTO insert_columns FROM pg_attribute
              WHERE attrelid = to_regclass(format('%I.%I', schema_name, table_name))
                AND attnum > 0 AND NOT attisdropped AND attgenerated = '';
            EXECUTE format('INSERT INTO %I.%I (%s) SELECT %s FROM %I.%I WHERE id::text = $1', schema_name, table_name, insert_columns, insert_columns, schema_name, table_name) USING sample_id;
          ELSIF operation = 'update' THEN
            EXECUTE format('UPDATE %I.%I SET id = id WHERE id::text = $1', schema_name, table_name) USING sample_id;
          ELSE
            EXECUTE format('DELETE FROM %I.%I WHERE id::text = $1', schema_name, table_name) USING sample_id;
          END IF;
          RAISE EXCEPTION 'Freeze guard did not reject % on %', operation, target_entity;
        EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
        END;
      END LOOP;
    END IF;
  END LOOP;
END $$;
COMMIT;

SELECT group_id, frozen_at,
  (SELECT count(*) FROM elo_migration_cutover.scope) AS protected_rows
FROM elo_migration_cutover.state;
