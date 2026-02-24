'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getGroup, getGroupLeaderboard, updateGroup, leaveGroup, Group, LeaderboardEntry } from '@/lib/groups';
import { formatMoney } from '@/lib/scoring';
import Avatar from '@/components/Avatar';

type SortField = 'lifetime_earnings' | 'win_rate' | 'total_rounds_played' | 'rounds_won' | 'rounds_lost' | 'avg_placement';

export default function GroupDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoading } = useApp();

    const groupId = params.id as string;
    const [group, setGroup] = useState<Group | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [sortBy, setSortBy] = useState<SortField>('lifetime_earnings');
    const [sortAsc, setSortAsc] = useState(false);

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        const loadData = async () => {
            if (!groupId) return;
            setIsLoadingData(true);

            const [groupData, leaderboardData] = await Promise.all([
                getGroup(groupId),
                getGroupLeaderboard(groupId)
            ]);

            setGroup(groupData);
            setLeaderboard(leaderboardData);

            if (groupData) {
                setEditName(groupData.name);
                setEditDesc(groupData.description || '');
            }

            setIsLoadingData(false);
        };
        loadData();
    }, [groupId]);

    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortBy(field);
            // Default sort directions: lower is better for avg_placement, higher is better for everything else
            setSortAsc(field === 'avg_placement' ? true : false);
        }
    };

    const sortedLeaderboard = [...leaderboard].sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

        // For avg_placement, treat 0 (no rounds) as worst
        if (sortBy === 'avg_placement') {
            if (a.total_rounds_played === 0) aVal = 99;
            if (b.total_rounds_played === 0) bVal = 99;
        }

        return sortAsc ? (aVal - bVal) : (bVal - aVal);
    });

    const handleSaveEdit = async () => {
        if (!group || !user) return;
        setIsSaving(true);

        const success = await updateGroup(group.id, user.id, {
            name: editName.trim(),
            description: editDesc.trim() || undefined
        });

        if (success) {
            setGroup({ ...group, name: editName.trim(), description: editDesc.trim() || null });
            setMessage({ type: 'success', text: 'Group updated!' });
            setShowEditModal(false);
        } else {
            setMessage({ type: 'error', text: 'Failed to update (only creator can edit)' });
        }

        setIsSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const handleLeaveGroup = async () => {
        if (!group || !user) return;
        if (!confirm(`Leave "${group.name}"? You can rejoin with the invite code.`)) return;

        const success = await leaveGroup(user.id, group.id);
        if (success) {
            router.push('/groups');
        }
    };

    const copyInviteCode = () => {
        if (group) {
            navigator.clipboard.writeText(group.invite_code);
            setMessage({ type: 'success', text: 'Invite code copied!' });
            setTimeout(() => setMessage(null), 2000);
        }
    };

    // Helper to get the stat value and color for a given field
    const getStatDisplay = (member: LeaderboardEntry, field: SortField): { value: string; color: string } => {
        switch (field) {
            case 'lifetime_earnings':
                return {
                    value: formatMoney(member.lifetime_earnings),
                    color: member.lifetime_earnings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                };
            case 'win_rate':
                return { value: `${member.win_rate.toFixed(1)}%`, color: 'var(--accent-gold)' };
            case 'total_rounds_played':
                return { value: `${member.total_rounds_played}`, color: 'var(--accent-purple)' };
            case 'rounds_won':
                return { value: `${member.rounds_won}`, color: 'var(--accent-green)' };
            case 'rounds_lost':
                return { value: `${member.rounds_lost}`, color: 'var(--accent-red)' };
            case 'avg_placement':
                return {
                    value: member.total_rounds_played > 0 ? member.avg_placement.toFixed(1) : '-',
                    color: 'var(--text-secondary)'
                };
        }
    };

    // Get the label for a sort field
    const getSortLabel = (field: SortField): string => {
        switch (field) {
            case 'lifetime_earnings': return 'Earnings';
            case 'win_rate': return 'Win Rate';
            case 'total_rounds_played': return 'Rounds';
            case 'rounds_won': return 'Wins';
            case 'rounds_lost': return 'Losses';
            case 'avg_placement': return 'Avg Place';
        }
    };

    if (isLoading || isLoadingData) {
        return (
            <div className="min-h-screen flex-center">
                <div className="text-2xl text-glow" style={{ color: 'var(--accent-gold)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (!user || !group) {
        return (
            <div className="min-h-screen flex-center flex-col gap-4">
                <div className="text-2xl">Group not found</div>
                <Link href="/groups" className="btn btn-secondary">Go to Groups</Link>
            </div>
        );
    }

    const isCreator = group.created_by === user.id;

    // Sort config
    const sortOptions: { field: SortField; label: string; emoji: string }[] = [
        { field: 'lifetime_earnings', label: 'Earnings', emoji: '💰' },
        { field: 'win_rate', label: 'Win Rate', emoji: '📊' },
        { field: 'avg_placement', label: 'Avg Place', emoji: '🎯' },
        { field: 'total_rounds_played', label: 'Rounds', emoji: '🎮' },
        { field: 'rounds_won', label: 'Wins', emoji: '🏆' },
        { field: 'rounds_lost', label: 'Losses', emoji: '❌' },
    ];

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container max-w-4xl">
                {/* Header */}
                <header className="mb-6 md:mb-8">
                    <Link href="/groups" className="btn btn-secondary mb-4">
                        ← Back
                    </Link>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-title text-2xl md:text-4xl">{group.name}</h1>
                            {group.description && (
                                <p style={{ color: 'var(--text-secondary)' }}>{group.description}</p>
                            )}
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {group.member_count} members
                            </p>
                        </div>
                        <div className="flex gap-sm flex-wrap">
                            <button onClick={copyInviteCode} className="btn btn-secondary">
                                📋 {group.invite_code}
                            </button>
                            {isCreator && (
                                <button onClick={() => setShowEditModal(true)} className="btn btn-secondary">
                                    ✏️ Edit
                                </button>
                            )}
                            <button onClick={handleLeaveGroup} className="btn btn-secondary" style={{ color: 'var(--accent-red)' }}>
                                Leave
                            </button>
                        </div>
                    </div>
                </header>

                {/* Message */}
                {message && (
                    <div
                        className="mb-6 p-4 rounded-lg text-center animate-fade-in"
                        style={{
                            background: message.type === 'success'
                                ? 'rgba(74, 222, 128, 0.2)'
                                : 'rgba(231, 76, 76, 0.2)',
                            color: message.type === 'success'
                                ? 'var(--accent-green)'
                                : 'var(--accent-red)'
                        }}
                    >
                        {message.text}
                    </div>
                )}

                {/* Sort Buttons */}
                <div className="mb-4 flex flex-wrap gap-2">
                    <span style={{ color: 'var(--text-muted)', lineHeight: '2.5rem', fontSize: '1rem' }}>Sort:</span>
                    {sortOptions.map(({ field, label, emoji }) => (
                        <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={`btn ${sortBy === field ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.7rem', padding: '0.4rem 0.6rem' }}
                        >
                            {emoji} {label} {sortBy === field && (sortAsc ? '↑' : '↓')}
                        </button>
                    ))}
                </div>

                {/* Leaderboard */}
                <section className="panel animate-slide-up">
                    <div className="panel-header">🏆 Leaderboard</div>

                    {sortedLeaderboard.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No members yet</p>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {sortedLeaderboard.map((member, index) => {
                                const isMe = member.user_id === user.id;
                                const primaryStat = getStatDisplay(member, sortBy);

                                return (
                                    <div
                                        key={member.id}
                                        className="player-card"
                                        style={{
                                            borderColor: isMe ? 'var(--accent-gold)' : undefined,
                                            background: isMe ? 'rgba(244, 196, 48, 0.08)' : undefined,
                                            cursor: 'default'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {/* Rank */}
                                            <span
                                                className="font-bold"
                                                style={{
                                                    color: index === 0 ? 'var(--accent-gold)' :
                                                        index === 1 ? '#c0c0c0' :
                                                            index === 2 ? '#cd7f32' : 'var(--text-muted)',
                                                    width: '1.75rem',
                                                    flexShrink: 0,
                                                    fontSize: '1.1rem',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {index + 1}
                                            </span>

                                            {/* Avatar + Name */}
                                            <Link
                                                href={`/profile/${member.user_id}`}
                                                className="hover:opacity-80 transition-opacity"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.6rem',
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <Avatar
                                                    userId={member.user_id}
                                                    username={member.username}
                                                    avatarColor={member.avatar_color}
                                                    size={12}
                                                    fontSize="0.35rem"
                                                />
                                                <span
                                                    className="font-bold"
                                                    style={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    {member.username}
                                                    {isMe && <span style={{ color: 'var(--accent-gold)', fontSize: '0.65rem' }}> (You)</span>}
                                                </span>
                                            </Link>

                                            {/* Primary stat (currently sorted by) - always visible */}
                                            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '3.5rem' }}>
                                                <div
                                                    className="font-bold font-mono"
                                                    style={{ color: primaryStat.color, fontSize: '0.85rem' }}
                                                >
                                                    {primaryStat.value}
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {getSortLabel(sortBy)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Secondary stats row */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(5, 1fr)',
                                            gap: '0.5rem',
                                            marginTop: '0.5rem',
                                            paddingTop: '0.5rem',
                                            borderTop: '1px solid var(--border-color)',
                                            textAlign: 'center'
                                        }}>
                                            {sortBy !== 'lifetime_earnings' && (
                                                <div>
                                                    <div className="font-bold font-mono" style={{
                                                        color: member.lifetime_earnings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                                        fontSize: '1rem'
                                                    }}>
                                                        {formatMoney(member.lifetime_earnings)}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Earnings</div>
                                                </div>
                                            )}
                                            {sortBy !== 'win_rate' && (
                                                <div>
                                                    <div className="font-bold font-mono" style={{ color: 'var(--accent-gold)', fontSize: '1rem' }}>
                                                        {member.win_rate.toFixed(0)}%
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Win Rate</div>
                                                </div>
                                            )}
                                            {sortBy !== 'avg_placement' && (
                                                <div>
                                                    <div className="font-bold font-mono" style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                                                        {member.total_rounds_played > 0 ? member.avg_placement.toFixed(1) : '-'}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Avg Place</div>
                                                </div>
                                            )}
                                            {sortBy !== 'total_rounds_played' && (
                                                <div>
                                                    <div className="font-bold font-mono" style={{ color: 'var(--accent-purple)', fontSize: '1rem' }}>
                                                        {member.total_rounds_played}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Rounds</div>
                                                </div>
                                            )}
                                            {sortBy !== 'rounds_won' && (
                                                <div>
                                                    <div className="font-bold font-mono" style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>
                                                        {member.rounds_won}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Wins</div>
                                                </div>
                                            )}
                                            {sortBy !== 'rounds_lost' && (
                                                <div>
                                                    <div className="font-bold font-mono" style={{ color: 'var(--accent-red)', fontSize: '1rem' }}>
                                                        {member.rounds_lost}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Losses</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/70 flex-center p-4 z-50" onClick={() => setShowEditModal(false)}>
                        <div className="panel w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="panel-header">Edit Group</div>

                            <div className="mb-4">
                                <label className="label">Group Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="label">Description</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-sm">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={!editName.trim() || isSaving}
                                    className="btn btn-primary flex-1"
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
