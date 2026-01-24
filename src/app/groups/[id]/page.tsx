'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getGroup, getGroupLeaderboard, updateGroup, leaveGroup, Group, LeaderboardEntry } from '@/lib/groups';
import { formatMoney } from '@/lib/scoring';

type SortField = 'lifetime_earnings' | 'win_rate' | 'total_rounds_played' | 'rounds_won' | 'rounds_lost' | 'sessions_played';

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
            setSortAsc(false);
        }
    };

    const sortedLeaderboard = [...leaderboard].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
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
                    <span style={{ color: 'var(--text-muted)', lineHeight: '2.5rem' }}>Sort by:</span>
                    {[
                        { field: 'lifetime_earnings' as SortField, label: '💰 Earnings' },
                        { field: 'win_rate' as SortField, label: '📊 Win Rate' },
                        { field: 'total_rounds_played' as SortField, label: '🎮 Rounds' },
                        { field: 'rounds_won' as SortField, label: '🏆 Wins' },
                        { field: 'rounds_lost' as SortField, label: '❌ Losses' },
                    ].map(({ field, label }) => (
                        <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={`btn ${sortBy === field ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                        >
                            {label} {sortBy === field && (sortAsc ? '↑' : '↓')}
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
                                return (
                                    <div
                                        key={member.id}
                                        className="player-card"
                                        style={{
                                            borderColor: isMe ? 'var(--accent-gold)' : undefined,
                                            background: isMe ? 'rgba(244, 196, 48, 0.1)' : undefined
                                        }}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                                            {/* Rank & Avatar */}
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className="font-bold text-xl"
                                                    style={{
                                                        color: index === 0 ? 'var(--accent-gold)' :
                                                            index === 1 ? '#c0c0c0' :
                                                                index === 2 ? '#cd7f32' : 'var(--text-muted)',
                                                        width: '2rem'
                                                    }}
                                                >
                                                    #{index + 1}
                                                </span>
                                                <div
                                                    className="player-avatar"
                                                    style={{
                                                        background: member.avatar_url
                                                            ? `url(${member.avatar_url}) center/cover`
                                                            : member.avatar_color,
                                                        width: 40,
                                                        height: 40
                                                    }}
                                                >
                                                    {!member.avatar_url && member.username.charAt(0)}
                                                </div>
                                                <span className="font-bold">
                                                    {member.username}
                                                    {isMe && <span style={{ color: 'var(--accent-gold)' }}> (You)</span>}
                                                </span>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 text-center md:text-right">
                                                <div>
                                                    <div className="font-bold" style={{
                                                        color: member.lifetime_earnings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                                                    }}>
                                                        {formatMoney(member.lifetime_earnings)}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Earnings</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold" style={{ color: 'var(--accent-gold)' }}>
                                                        {member.win_rate.toFixed(1)}%
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Win Rate</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold" style={{ color: 'var(--accent-purple)' }}>
                                                        {member.total_rounds_played}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Rounds</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold" style={{ color: 'var(--accent-green)' }}>
                                                        {member.rounds_won}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Wins</div>
                                                </div>
                                                <div>
                                                    <div className="font-bold" style={{ color: 'var(--accent-red)' }}>
                                                        {member.rounds_lost}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Losses</div>
                                                </div>
                                            </div>
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
