-- Create enums for game configuration
CREATE TYPE public.game_type AS ENUM ('301', '501');
CREATE TYPE public.start_rule AS ENUM ('straight-in', 'double-in');
CREATE TYPE public.end_rule AS ENUM ('straight-out', 'double-out');
CREATE TYPE public.game_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- Create live_games table
CREATE TABLE public.live_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type public.game_type NOT NULL,
  start_rule public.start_rule NOT NULL,
  end_rule public.end_rule NOT NULL,
  status public.game_status NOT NULL DEFAULT 'in_progress',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone
);

-- Create live_game_players table
CREATE TABLE public.live_game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.live_games(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  is_temporary boolean NOT NULL DEFAULT false,
  play_order integer NOT NULL,
  starting_score integer NOT NULL,
  finished_rank integer,
  CONSTRAINT positive_play_order CHECK (play_order > 0),
  CONSTRAINT positive_starting_score CHECK (starting_score > 0),
  CONSTRAINT positive_finished_rank CHECK (finished_rank IS NULL OR finished_rank > 0),
  UNIQUE(game_id, play_order)
);

-- Create game_throws table
CREATE TABLE public.game_throws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.live_games(id) ON DELETE CASCADE,
  game_player_id uuid NOT NULL REFERENCES public.live_game_players(id) ON DELETE CASCADE,
  turn_number integer NOT NULL,
  throw_index integer NOT NULL,
  segment integer NOT NULL,
  multiplier integer NOT NULL,
  score integer NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valid_turn_number CHECK (turn_number >= 1),
  CONSTRAINT valid_throw_index CHECK (throw_index >= 0 AND throw_index <= 2),
  CONSTRAINT valid_segment CHECK (segment >= 0 AND segment <= 50),
  CONSTRAINT valid_multiplier CHECK (multiplier >= 1 AND multiplier <= 3),
  CONSTRAINT valid_score CHECK (score >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_live_games_group_id ON public.live_games(group_id);
CREATE INDEX idx_live_games_created_by ON public.live_games(created_by);
CREATE INDEX idx_live_games_status ON public.live_games(status);
CREATE INDEX idx_live_game_players_game_id ON public.live_game_players(game_id);
CREATE INDEX idx_live_game_players_player_id ON public.live_game_players(player_id);
CREATE INDEX idx_game_throws_game_id ON public.game_throws(game_id);
CREATE INDEX idx_game_throws_game_player_id ON public.game_throws(game_player_id);
CREATE INDEX idx_game_throws_created_at ON public.game_throws(created_at);

-- Enable RLS
ALTER TABLE public.live_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_throws ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_games

-- Users can only see games in groups they belong to
CREATE POLICY "Users can view games in their groups"
ON public.live_games FOR SELECT
USING (public.is_group_member(auth.uid(), group_id));

-- Users can only create games in groups they belong to
CREATE POLICY "Users can create games in their groups"
ON public.live_games FOR INSERT
WITH CHECK (
  public.is_group_member(auth.uid(), group_id) 
  AND created_by = auth.uid()
);

-- Only game creator can update their game
CREATE POLICY "Creators can update their games"
ON public.live_games FOR UPDATE
USING (created_by = auth.uid());

-- Only game creator can delete their game
CREATE POLICY "Creators can delete their games"
ON public.live_games FOR DELETE
USING (created_by = auth.uid());

-- RLS Policies for live_game_players

-- Users can view players in games they can see
CREATE POLICY "Users can view game players in their groups"
ON public.live_game_players FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND public.is_group_member(auth.uid(), lg.group_id)
  )
);

-- Game creators can add players
CREATE POLICY "Game creators can add players"
ON public.live_game_players FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.created_by = auth.uid()
  )
);

-- Game creators can update players (for finished_rank)
CREATE POLICY "Game creators can update players"
ON public.live_game_players FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.created_by = auth.uid()
  )
);

-- Game creators can delete players
CREATE POLICY "Game creators can delete players"
ON public.live_game_players FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.created_by = auth.uid()
  )
);

-- RLS Policies for game_throws

-- Users can view throws in games they can see
CREATE POLICY "Users can view throws in their groups"
ON public.game_throws FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND public.is_group_member(auth.uid(), lg.group_id)
  )
);

-- Game creators can add throws
CREATE POLICY "Game creators can add throws"
ON public.game_throws FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.created_by = auth.uid()
  )
);

-- Game creators can delete throws (for undo)
CREATE POLICY "Game creators can delete throws"
ON public.game_throws FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.live_games lg
    WHERE lg.id = game_id
    AND lg.created_by = auth.uid()
  )
);

