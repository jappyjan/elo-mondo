CREATE OR REPLACE FUNCTION public.ensure_group_temp_player(
  _group_id uuid,
  _player_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _normalized_name text;
  _player_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_group_member(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'You must be a group member to add temporary players';
  END IF;

  _normalized_name := btrim(_player_name);

  IF _normalized_name = '' THEN
    RAISE EXCEPTION 'Player name is required';
  END IF;

  SELECT id
  INTO _player_id
  FROM public.players
  WHERE name = _normalized_name
  LIMIT 1;

  IF _player_id IS NULL THEN
    INSERT INTO public.players (name)
    VALUES (_normalized_name)
    RETURNING id INTO _player_id;
  END IF;

  INSERT INTO public.group_members (group_id, player_id, role)
  VALUES (_group_id, _player_id, 'member')
  ON CONFLICT (group_id, player_id) DO NOTHING;

  RETURN _player_id;
END;
$$;
