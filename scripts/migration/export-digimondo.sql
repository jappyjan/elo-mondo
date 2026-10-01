-- One SELECT gives every table the same PostgreSQL statement snapshot.
-- No writes, triggers, or source migrations are executed.
WITH selected_group AS (
  SELECT * FROM public.groups
  WHERE id = '8195d6b6-f5a5-455d-a9d6-a8adf37970cd'::uuid
    AND upper(name) = 'DIGIMONDO'
), selected_members AS (
  SELECT * FROM public.group_members WHERE group_id IN (SELECT id FROM selected_group)
), selected_matches AS (
  SELECT * FROM public.matches WHERE group_id IN (SELECT id FROM selected_group)
), selected_participants AS (
  SELECT * FROM public.match_participants WHERE match_id IN (SELECT id FROM selected_matches)
), selected_games AS (
  SELECT * FROM public.live_games WHERE group_id IN (SELECT id FROM selected_group)
), selected_game_players AS (
  SELECT * FROM public.live_game_players WHERE game_id IN (SELECT id FROM selected_games)
), selected_throws AS (
  SELECT * FROM public.game_throws WHERE game_id IN (SELECT id FROM selected_games)
), selected_invites AS (
  SELECT * FROM public.group_invites WHERE group_id IN (SELECT id FROM selected_group)
), selected_codes AS (
  SELECT * FROM public.group_invite_codes WHERE group_id IN (SELECT id FROM selected_group)
), selected_players AS (
  SELECT * FROM public.players WHERE id IN (
    SELECT player_id FROM selected_members
    UNION SELECT winner_id FROM selected_matches
    UNION SELECT loser_id FROM selected_matches
    UNION SELECT player_id FROM selected_participants
    UNION SELECT player_id FROM selected_game_players WHERE player_id IS NOT NULL
  )
), selected_users AS (
  SELECT * FROM auth.users WHERE id IN (
    SELECT user_id FROM selected_players WHERE user_id IS NOT NULL
    UNION SELECT created_by FROM selected_group WHERE created_by IS NOT NULL
    UNION SELECT created_by FROM selected_games
    UNION SELECT invited_by FROM selected_invites WHERE invited_by IS NOT NULL
  )
)
SELECT jsonb_build_object(
  'format_version', 1,
  'source_project_ref', 'stzilnijaoxwqyuyryts',
  'exported_at', statement_timestamp(),
  'group_id', '8195d6b6-f5a5-455d-a9d6-a8adf37970cd',
  'tables', jsonb_build_object(
    'groups', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_group t), '[]'::jsonb),
    'group_members', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_members t), '[]'::jsonb),
    'group_invites', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_invites t), '[]'::jsonb),
    'group_invite_codes', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_codes t), '[]'::jsonb),
    'players', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_players t), '[]'::jsonb),
    'matches', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_matches t), '[]'::jsonb),
    'match_participants', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_participants t), '[]'::jsonb),
    'live_games', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_games t), '[]'::jsonb),
    'live_game_players', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_game_players t), '[]'::jsonb),
    'game_throws', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_throws t), '[]'::jsonb),
    'auth_users', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM selected_users t), '[]'::jsonb),
    'auth_identities', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth.identities t WHERE user_id IN (SELECT id FROM selected_users)), '[]'::jsonb),
    'auth_mfa_factors', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth.mfa_factors t WHERE user_id IN (SELECT id FROM selected_users)), '[]'::jsonb)
  )
) AS payload;
