
-- Remove the initial sample players that were added for testing
DELETE FROM public.players 
WHERE name IN ('Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson')
AND elo_rating = 1000 
AND matches_played = 0 
AND wins = 0 
AND losses = 0;
