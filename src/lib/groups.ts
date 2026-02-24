/**
 * Groups Service
 * Handles group creation, joining, leaving, and leaderboard data
 */

import { createClient } from './supabase';

const supabase = createClient();

export interface Group {
    id: string;
    name: string;
    description: string | null;
    invite_code: string;
    created_by: string;
    created_at: string;
    member_count?: number;
}

export interface GroupMember {
    id: string;
    user_id: string;
    username: string;
    avatar_color: string;
    avatar_url?: string;
    joined_at: string;
    // Stats for leaderboard
    total_rounds_played: number;
    rounds_won: number;
    lifetime_earnings: number;
    sessions_played: number;
}

export interface LeaderboardEntry extends GroupMember {
    win_rate: number;
    rounds_lost: number;
    avg_placement: number;
    total_placement_sum: number;
}

// Generate a random invite code
function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Create a new group
 */
export async function createGroup(
    userId: string,
    name: string,
    description?: string
): Promise<Group | null> {
    if (!supabase) return null;

    const inviteCode = generateInviteCode();

    const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
            name,
            description: description || null,
            invite_code: inviteCode,
            created_by: userId
        })
        .select()
        .single();

    if (groupError || !groupData) {
        console.error('Error creating group:', groupError);
        return null;
    }

    // Auto-join creator to the group
    await supabase.from('group_members').insert({
        group_id: groupData.id,
        user_id: userId
    });

    return {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        invite_code: groupData.invite_code,
        created_by: groupData.created_by,
        created_at: groupData.created_at,
        member_count: 1
    };
}

/**
 * Join a group by invite code
 */
export async function joinGroup(userId: string, inviteCode: string): Promise<{ success: boolean; group?: Group; error?: string }> {
    if (!supabase) return { success: false, error: 'Not connected' };

    // Find group by invite code
    const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

    if (groupError || !groupData) {
        return { success: false, error: 'Invalid invite code' };
    }

    // Check if already a member
    const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupData.id)
        .eq('user_id', userId)
        .single();

    if (existingMember) {
        return { success: false, error: 'Already a member of this group' };
    }

    // Join the group
    const { error: joinError } = await supabase
        .from('group_members')
        .insert({
            group_id: groupData.id,
            user_id: userId
        });

    if (joinError) {
        console.error('Error joining group:', joinError);
        return { success: false, error: 'Failed to join group' };
    }

    return {
        success: true,
        group: {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            invite_code: groupData.invite_code,
            created_by: groupData.created_by,
            created_at: groupData.created_at
        }
    };
}

/**
 * Leave a group
 */
export async function leaveGroup(userId: string, groupId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

    return !error;
}

/**
 * Update group details (name, description)
 */
export async function updateGroup(
    groupId: string,
    userId: string,
    updates: { name?: string; description?: string }
): Promise<boolean> {
    if (!supabase) return false;

    // Only creator can update
    const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();

    if (!group || group.created_by !== userId) {
        return false;
    }

    const { error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId);

    return !error;
}

/**
 * Get user's groups
 */
export async function getMyGroups(userId: string): Promise<Group[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('group_members')
        .select(`
            group_id,
            groups(*)
        `)
        .eq('user_id', userId);

    if (error || !data) {
        console.error('Error fetching groups:', error);
        return [];
    }

    // Get member counts
    const groups: Group[] = [];
    for (const item of data) {
        const groupData = (item.groups as unknown) as Record<string, unknown>;
        if (groupData) {
            const { count } = await supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', item.group_id);

            groups.push({
                id: groupData.id as string,
                name: groupData.name as string,
                description: groupData.description as string | null,
                invite_code: groupData.invite_code as string,
                created_by: groupData.created_by as string,
                created_at: groupData.created_at as string,
                member_count: count || 0
            });
        }
    }

    return groups;
}

/**
 * Get a single group by ID
 */
export async function getGroup(groupId: string): Promise<Group | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

    if (error || !data) return null;

    const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

    return {
        id: data.id,
        name: data.name,
        description: data.description,
        invite_code: data.invite_code,
        created_by: data.created_by,
        created_at: data.created_at,
        member_count: count || 0
    };
}

/**
 * Get group members with stats for leaderboard
 */
export async function getGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
    if (!supabase) return [];

    // Get group members
    const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('id, user_id, joined_at')
        .eq('group_id', groupId);

    if (membersError || !members || members.length === 0) {
        console.error('Error fetching members:', membersError);
        return [];
    }

    // Get user IDs
    const userIds = members.map(m => m.user_id);

    // Fetch profiles
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_color, avatar_url')
        .in('id', userIds);

    // Fetch stats
    const { data: stats } = await supabase
        .from('user_stats')
        .select('user_id, total_rounds_played, rounds_won, lifetime_earnings, sessions_played, total_placement_sum')
        .in('user_id', userIds);

    // Create lookup maps
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const statsMap = new Map(stats?.map(s => [s.user_id, s]) || []);

    return members.map(member => {
        const profile = profileMap.get(member.user_id);
        const stat = statsMap.get(member.user_id);

        const totalRounds = stat?.total_rounds_played || 0;
        const roundsWon = stat?.rounds_won || 0;
        const winRate = totalRounds > 0 ? (roundsWon / totalRounds) * 100 : 0;

        return {
            id: member.id,
            user_id: member.user_id,
            username: profile?.username || 'Unknown',
            avatar_color: profile?.avatar_color || '#a855f7',
            avatar_url: profile?.avatar_url,
            joined_at: member.joined_at,
            total_rounds_played: totalRounds,
            rounds_won: roundsWon,
            rounds_lost: totalRounds - roundsWon,
            lifetime_earnings: Number(stat?.lifetime_earnings) || 0,
            sessions_played: stat?.sessions_played || 0,
            win_rate: winRate,
            total_placement_sum: stat?.total_placement_sum || 0,
            avg_placement: totalRounds > 0 ? (stat?.total_placement_sum || 0) / totalRounds : 0
        };
    });
}

/**
 * Get group members for session quick-add
 */
export async function getGroupMembers(groupId: string): Promise<{ id: string; username: string; avatar_color: string }[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('group_members')
        .select(`
            user_id,
            profiles(username, avatar_color)
        `)
        .eq('group_id', groupId);

    if (error || !data) return [];

    return data.map(member => {
        const profile = (member.profiles as unknown) as Record<string, unknown> | null;
        return {
            id: member.user_id,
            username: (profile?.username as string) || 'Unknown',
            avatar_color: (profile?.avatar_color as string) || '#a855f7'
        };
    });
}
