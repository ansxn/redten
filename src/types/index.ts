// Core types for Red 10 Score Tracker

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: string;
  avatar_color?: string;
}

export interface UserStats {
  user_id: string;
  total_rounds_played: number;
  rounds_won: number;
  lifetime_earnings: number; // Can be negative (losses)
  sessions_played: number;
  best_session: number;
  worst_session: number;
}

export interface Session {
  id: string;
  created_at: string;
  created_by: string;
  players: SessionPlayer[];
  rounds: Round[];
  status: 'active' | 'completed';
  point_value: number; // Dollar value per point (default 1)
  name?: string;
}

export interface SessionPlayer {
  user_id: string;
  username: string;
  session_score: number; // Running total for this session
  is_guest: boolean;
  avatar_color: string;
}

export interface Round {
  id: string;
  round_number: number;
  multiplier: 1 | 2 | 4; // Base, Called (2x), Double Called (4x)
  red_team_player_ids: string[]; // Players holding Red 10s
  finish_order: string[]; // Player IDs in order from 1st to 6th (who got out first)
  result: 'red_win' | 'blue_win' | 'wash';
  points_awarded: Record<string, number>; // player_id -> points gained/lost
  created_at: string;
}

export interface Transaction {
  from_player: SessionPlayer;
  to_player: SessionPlayer;
  amount: number; // Dollar amount
}

// Helper type for creating new sessions
export interface NewSessionData {
  players: {
    username: string;
    user_id?: string; // If linked to existing user
    is_guest: boolean;
  }[];
  point_value: number;
  name?: string;
}

// Round creation data
export interface NewRoundData {
  multiplier: 1 | 2 | 4;
  red_team_player_ids: string[];
  finish_order: string[];  // Player IDs in order from 1st to 6th
  result: 'red_win' | 'blue_win' | 'wash';
}

// Avatar color options
export const AVATAR_COLORS = [
  '#e74c4c', // Red
  '#f4c430', // Gold
  '#4ade80', // Green
  '#60a5fa', // Blue
  '#a855f7', // Purple
  '#f97316', // Orange
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

// Generate a random avatar color
export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
