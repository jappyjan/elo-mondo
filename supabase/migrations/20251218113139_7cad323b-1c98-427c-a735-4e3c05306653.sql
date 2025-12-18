-- Create dedicated table for group invite codes
CREATE TABLE public.group_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_code text NOT NULL DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id),
  UNIQUE(invite_code)
);

-- Migrate existing invite codes
INSERT INTO public.group_invite_codes (group_id, invite_code)
SELECT id, invite_code FROM public.groups WHERE invite_code IS NOT NULL;

-- Drop invite_code column from groups
ALTER TABLE public.groups DROP COLUMN invite_code;

-- Enable RLS
ALTER TABLE public.group_invite_codes ENABLE ROW LEVEL SECURITY;

-- Only group admins can view invite codes
CREATE POLICY "Group admins can view invite codes"
ON public.group_invite_codes
FOR SELECT
USING (is_group_admin(auth.uid(), group_id));

-- Only group admins can update invite codes
CREATE POLICY "Group admins can update invite codes"
ON public.group_invite_codes
FOR UPDATE
USING (is_group_admin(auth.uid(), group_id));

-- Only group admins can delete invite codes
CREATE POLICY "Group admins can delete invite codes"
ON public.group_invite_codes
FOR DELETE
USING (is_group_admin(auth.uid(), group_id));

-- Group admins can create invite codes (for regeneration)
CREATE POLICY "Group admins can create invite codes"
ON public.group_invite_codes
FOR INSERT
WITH CHECK (is_group_admin(auth.uid(), group_id));

-- Update join_group_by_code function to use new table
CREATE OR REPLACE FUNCTION public.join_group_by_code(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _group_id uuid;
  _player_id uuid;
BEGIN
  -- Find the group by invite code from the new table
  SELECT group_id INTO _group_id FROM public.group_invite_codes WHERE invite_code = _invite_code;
  
  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Get player for current user
  SELECT id INTO _player_id FROM public.players WHERE user_id = auth.uid();
  
  IF _player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile found. Please create your player profile first.';
  END IF;
  
  -- Check if already a member
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND player_id = _player_id) THEN
    RAISE EXCEPTION 'Already a member of this group';
  END IF;
  
  -- Add as member
  INSERT INTO public.group_members (group_id, player_id, role)
  VALUES (_group_id, _player_id, 'member');
  
  RETURN _group_id;
END;
$$;

-- Update handle_new_group to also create invite code entry
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _player_id uuid;
BEGIN
  -- Get the player_id for the creator
  SELECT id INTO _player_id FROM public.players WHERE user_id = NEW.created_by;
  
  IF _player_id IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, player_id, role)
    VALUES (NEW.id, _player_id, 'admin');
  END IF;
  
  -- Create invite code for the new group
  INSERT INTO public.group_invite_codes (group_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;