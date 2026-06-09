-- Public analytics can read completed dart games, matching public match history.
-- In-progress games remain protected by the existing group-member policies.

CREATE POLICY "Anyone can view completed live games"
ON public.live_games
FOR SELECT
USING (status = 'completed');

CREATE POLICY "Anyone can view completed live game players"
ON public.live_game_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.status = 'completed'
  )
);

CREATE POLICY "Anyone can view completed game throws"
ON public.game_throws
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.status = 'completed'
  )
);
