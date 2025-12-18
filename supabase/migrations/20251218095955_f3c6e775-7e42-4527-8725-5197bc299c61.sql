-- Remove Elo columns from match_participants
ALTER TABLE public.match_participants 
DROP COLUMN IF EXISTS elo_before,
DROP COLUMN IF EXISTS elo_after,
DROP COLUMN IF EXISTS elo_change;

-- Remove Elo columns from matches
ALTER TABLE public.matches 
DROP COLUMN IF EXISTS winner_elo_before,
DROP COLUMN IF EXISTS loser_elo_before,
DROP COLUMN IF EXISTS winner_elo_after,
DROP COLUMN IF EXISTS loser_elo_after,
DROP COLUMN IF EXISTS elo_change;

-- Remove stats columns from players (Elo is calculated on-the-fly)
ALTER TABLE public.players 
DROP COLUMN IF EXISTS elo_rating,
DROP COLUMN IF EXISTS matches_played,
DROP COLUMN IF EXISTS wins,
DROP COLUMN IF EXISTS losses;