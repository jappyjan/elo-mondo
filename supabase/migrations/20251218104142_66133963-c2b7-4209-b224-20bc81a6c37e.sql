-- Create enum for group roles
CREATE TYPE public.group_role AS ENUM ('admin', 'member');

-- Create groups table
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create group_members table (links players to groups)
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role group_role NOT NULL DEFAULT 'member',
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, player_id)
);

-- Create group_invites table for email invitations
CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(group_id, email)
);

-- Add user_id to players (nullable for backwards compatibility with existing players)
ALTER TABLE public.players ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.players ADD CONSTRAINT players_user_id_unique UNIQUE (user_id);

-- Add group_id to matches
ALTER TABLE public.matches ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Security definer function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.players p ON p.id = gm.player_id
    WHERE gm.group_id = _group_id
      AND p.user_id = _user_id
  )
$$;

-- Security definer function to check group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.players p ON p.id = gm.player_id
    WHERE gm.group_id = _group_id
      AND p.user_id = _user_id
      AND gm.role = 'admin'
  )
$$;

-- Security definer function to get player_id for a user
CREATE OR REPLACE FUNCTION public.get_player_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.players WHERE user_id = _user_id LIMIT 1
$$;

-- Groups policies (public read, authenticated create)
CREATE POLICY "Anyone can view groups" ON public.groups
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update their groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(auth.uid(), id));

-- Group members policies
CREATE POLICY "Anyone can view group members" ON public.group_members
  FOR SELECT USING (true);

CREATE POLICY "Group admins can add members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Group admins can update members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Group admins can remove members" ON public.group_members
  FOR DELETE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));

-- Group invites policies
CREATE POLICY "Group members can view invites" ON public.group_invites
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group admins can create invites" ON public.group_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(auth.uid(), group_id));

CREATE POLICY "Group admins can delete invites" ON public.group_invites
  FOR DELETE TO authenticated
  USING (public.is_group_admin(auth.uid(), group_id));

-- Update players policies to allow users to update their own player
CREATE POLICY "Users can update their own player" ON public.players
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Update matches policies for group context
DROP POLICY IF EXISTS "Anyone can insert matches" ON public.matches;
CREATE POLICY "Group members can insert matches" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(auth.uid(), group_id));

-- Function to accept invite by code and add user to group
CREATE OR REPLACE FUNCTION public.join_group_by_code(_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
  _player_id uuid;
BEGIN
  -- Find the group by invite code
  SELECT id INTO _group_id FROM public.groups WHERE invite_code = _invite_code;
  
  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Get or create player for current user
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

-- Function to accept email invite
CREATE OR REPLACE FUNCTION public.accept_group_invite(_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
  _player_id uuid;
  _invite_email text;
  _user_email text;
BEGIN
  -- Get invite details
  SELECT group_id, email INTO _group_id, _invite_email
  FROM public.group_invites
  WHERE id = _invite_id AND expires_at > now();
  
  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;
  
  -- Get user email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email != _invite_email THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;
  
  -- Get player for current user
  SELECT id INTO _player_id FROM public.players WHERE user_id = auth.uid();
  
  IF _player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile found';
  END IF;
  
  -- Add as member
  INSERT INTO public.group_members (group_id, player_id, role)
  VALUES (_group_id, _player_id, 'member')
  ON CONFLICT (group_id, player_id) DO NOTHING;
  
  -- Delete the invite
  DELETE FROM public.group_invites WHERE id = _invite_id;
  
  RETURN _group_id;
END;
$$;

-- Trigger to make group creator an admin
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();