/**
 * Friends Database Service
 * Handles all friend-related database operations
 */

import { createClient } from './supabase';

export interface Friend {
    id: string;
    username: string;
    avatar_color: string;
    created_at: string;
}

export interface UserProfile {
    id: string;
    username: string;
    avatar_color: string;
}

const supabase = createClient();

// Get all friends for the current user
export async function getFriends(userId: string): Promise<Friend[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('friends')
        .select(`
      id,
      friend:friend_id(id, username, avatar_color),
      created_at
    `)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching friends:', error);
        return [];
    }

    return (data || []).map(f => ({
        id: (f.friend as unknown as UserProfile).id,
        username: (f.friend as unknown as UserProfile).username,
        avatar_color: (f.friend as unknown as UserProfile).avatar_color || '#a855f7',
        created_at: f.created_at
    }));
}

// Search for users by email or username
export async function searchUsers(query: string, currentUserId: string): Promise<UserProfile[]> {
    if (!supabase || !query.trim()) return [];

    // Search by username
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_color')
        .neq('id', currentUserId)  // Exclude current user
        .ilike('username', `%${query}%`)
        .limit(10);

    if (error) {
        console.error('Error searching users:', error);
        return [];
    }

    return data || [];
}

// Find user by exact email (for adding friends)
export async function findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!supabase || !email.trim()) return null;

    // We need to query auth.users for email, but that's not directly accessible
    // Instead, we'll use RPC or search by username that might contain email
    // For now, we'll assume username search works

    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_color')
        .ilike('username', email.split('@')[0])
        .limit(1)
        .single();

    if (error) {
        console.error('Error finding user:', error);
        return null;
    }

    return data;
}

// Add a friend
export async function addFriend(userId: string, friendId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('friends')
        .insert({ user_id: userId, friend_id: friendId });

    if (error) {
        console.error('Error adding friend:', error);
        return false;
    }

    // Also add reverse relationship so friend can see you
    await supabase
        .from('friends')
        .insert({ user_id: friendId, friend_id: userId })
        .then(() => { });  // Ignore error if already exists

    return true;
}

// Remove a friend
export async function removeFriend(userId: string, friendId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

    if (error) {
        console.error('Error removing friend:', error);
        return false;
    }

    // Also remove reverse relationship
    await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId);

    return true;
}
