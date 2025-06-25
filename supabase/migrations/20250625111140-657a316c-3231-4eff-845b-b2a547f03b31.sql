
-- Create players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  winner_id UUID NOT NULL REFERENCES public.players(id),
  loser_id UUID NOT NULL REFERENCES public.players(id),
  winner_elo_before INTEGER NOT NULL,
  loser_elo_before INTEGER NOT NULL,  
  winner_elo_after INTEGER NOT NULL,
  loser_elo_after INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) - making it public for now since this is an internal company leaderboard
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (company leaderboard)
CREATE POLICY "Anyone can view players" 
  ON public.players 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert players" 
  ON public.players 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update players" 
  ON public.players 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can view matches" 
  ON public.matches 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert matches" 
  ON public.matches 
  FOR INSERT 
  WITH CHECK (true);

-- Add some initial sample players for testing
INSERT INTO public.players (name, elo_rating) VALUES 
  ('Alice Johnson', 1000),
  ('Bob Smith', 1000),
  ('Carol Davis', 1000),
  ('David Wilson', 1000);
