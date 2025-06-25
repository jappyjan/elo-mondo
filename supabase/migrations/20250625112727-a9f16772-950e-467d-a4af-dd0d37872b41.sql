
-- First, let's update the matches table to support multi-player matches
-- We'll keep the existing structure for backward compatibility but add support for multiple losers

-- Create a new table for match participants to handle multi-player matches
CREATE TABLE public.match_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL,
  player_id UUID NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  elo_before INTEGER NOT NULL,
  elo_after INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add a match_type column to distinguish between 1v1 and multiplayer matches
ALTER TABLE public.matches ADD COLUMN match_type TEXT NOT NULL DEFAULT '1v1';
ALTER TABLE public.matches ADD COLUMN total_players INTEGER NOT NULL DEFAULT 2;

-- Add check constraint to ensure valid match types
ALTER TABLE public.matches ADD CONSTRAINT valid_match_type 
  CHECK (match_type IN ('1v1', 'multiplayer'));

-- Create indexes for better performance
CREATE INDEX idx_match_participants_match_id ON public.match_participants(match_id);
CREATE INDEX idx_match_participants_player_id ON public.match_participants(player_id);
CREATE INDEX idx_matches_match_type ON public.matches(match_type);

-- Add foreign key constraints
ALTER TABLE public.match_participants 
  ADD CONSTRAINT fk_match_participants_match_id 
  FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

ALTER TABLE public.match_participants 
  ADD CONSTRAINT fk_match_participants_player_id 
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
