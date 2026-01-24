-- Red 10 Score Tracker - Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable RLS (Row Level Security)
-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_color TEXT DEFAULT '#a855f7',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User statistics
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  total_rounds_played INTEGER DEFAULT 0,
  rounds_won INTEGER DEFAULT 0,
  lifetime_earnings DECIMAL(10,2) DEFAULT 0,
  sessions_played INTEGER DEFAULT 0,
  best_session DECIMAL(10,2) DEFAULT 0,
  worst_session DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT,
  point_value DECIMAL(5,2) DEFAULT 1.00,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session players (links users/guests to sessions)
CREATE TABLE IF NOT EXISTS public.session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  is_guest BOOLEAN DEFAULT false,
  avatar_color TEXT DEFAULT '#a855f7',
  session_score DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friends list
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Rounds within sessions
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  multiplier INTEGER DEFAULT 1 CHECK (multiplier IN (1, 2, 4)),
  result TEXT NOT NULL CHECK (result IN ('red_win', 'blue_win', 'wash')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Red team assignments per round
CREATE TABLE IF NOT EXISTS public.round_red_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.session_players(id) ON DELETE CASCADE
);

-- Points awarded per round per player
CREATE TABLE IF NOT EXISTS public.round_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.session_players(id) ON DELETE CASCADE,
  points DECIMAL(10,2) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_red_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read all profiles but only update their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User Stats: Users can only see and modify their own stats
CREATE POLICY "Users can view own stats" ON public.user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON public.user_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON public.user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sessions: Anyone can view sessions they're part of
CREATE POLICY "Users can view sessions" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Session creators can update" ON public.sessions
  FOR UPDATE USING (auth.uid() = created_by);

-- Session Players: Viewable by session participants
CREATE POLICY "Session players viewable" ON public.session_players
  FOR SELECT USING (true);

CREATE POLICY "Can add players to own sessions" ON public.session_players
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND created_by = auth.uid())
  );

CREATE POLICY "Can update players in own sessions" ON public.session_players
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND created_by = auth.uid())
  );

-- Rounds: Viewable and creatable by session participants
CREATE POLICY "Rounds viewable" ON public.rounds
  FOR SELECT USING (true);

CREATE POLICY "Can create rounds in own sessions" ON public.rounds
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND created_by = auth.uid())
  );

-- Round Red Team
CREATE POLICY "Round red team viewable" ON public.round_red_team
  FOR SELECT USING (true);

CREATE POLICY "Can modify round red team" ON public.round_red_team
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      WHERE r.id = round_id AND s.created_by = auth.uid()
    )
  );

-- Round Points
CREATE POLICY "Round points viewable" ON public.round_points
  FOR SELECT USING (true);

CREATE POLICY "Can add round points" ON public.round_points
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds r
      JOIN public.sessions s ON r.session_id = s.id
      WHERE r.id = round_id AND s.created_by = auth.uid()
    )
  );

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_players_session ON public.session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_session_players_user ON public.session_players(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_session ON public.rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_round_points_round ON public.round_points(round_id);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);

-- Friends RLS Policies
CREATE POLICY "Users can view own friends" ON public.friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can add friends" ON public.friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own friends" ON public.friends
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- GROUPS SYSTEM
-- ========================================

-- Groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Policies for groups
CREATE POLICY "Anyone can view groups" ON public.groups
  FOR SELECT USING (true);

CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update groups" ON public.groups
  FOR UPDATE USING (auth.uid() = created_by);

-- Policies for group members
CREATE POLICY "Members viewable" ON public.group_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" ON public.group_members
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);

-- Update user_stats RLS to allow viewing group members' stats
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
CREATE POLICY "Users can view stats in their groups" ON public.user_stats
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = user_stats.user_id
    )
  );
