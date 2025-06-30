
-- Add rank column to match_participants table to store player rankings
ALTER TABLE public.match_participants 
ADD COLUMN rank INTEGER;

-- Update existing match_participants to have rank 1 for winners and rank 2 for losers
UPDATE public.match_participants 
SET rank = CASE 
  WHEN is_winner = true THEN 1 
  ELSE 2 
END;

-- Make rank column NOT NULL now that we've populated it
ALTER TABLE public.match_participants 
ALTER COLUMN rank SET NOT NULL;

-- Add a check constraint to ensure rank is positive
ALTER TABLE public.match_participants 
ADD CONSTRAINT positive_rank CHECK (rank > 0);

-- Add index for better performance when querying by rank
CREATE INDEX idx_match_participants_rank ON public.match_participants(rank);
