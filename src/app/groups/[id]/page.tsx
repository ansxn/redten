'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getGroup, getGroupLeaderboard, updateGroup, leaveGroup, Group, LeaderboardEntry } from '@/lib/groups';
import { formatMoney } from '@/lib/scoring';
import Avatar from '@/components/Avatar';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import LoadingScreen from '@/components/LoadingScreen';
import Toast from '@/components/Toast';
import Modal from '@/components/Modal';

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
            setSortAsc(field === 'avg_placement' ? true : false);
        }
    };

    const sortedLeaderboard = [...leaderboard].sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

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

    if (isLoading || isLoadingData) return <LoadingScreen />;

    if (!user || !group) {
        return (
            <div className="min-h-screen flex-center" style={{ flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <div style={{ fontSize: '1.5rem' }}>Group not found</div>
                <Link href="/groups" className="btn btn-secondary">Go to Groups</Link>
            </div>
        );
    }

    const isCreator = group.created_by === user.id;

    const sortOptions: { field: SortField; label: string; emoji: string }[] = [
        { field: 'lifetime_earnings', label: 'Earnings', emoji: '💰' },
        { field: 'win_rate', label: 'Win Rate', emoji: '📊' },
        { field: 'avg_placement', label: 'Avg Place', emoji: '🎯' },
        { field: 'total_rounds_played', label: 'Rounds', emoji: '🎮' },
        { field: 'rounds_won', label: 'Wins', emoji: '🏆' },
        { field: 'rounds_lost', label: 'Losses', emoji: '❌' },
    ];

    // Build secondary stat fields (all except the primary sort field)
    const secondaryFields = sortOptions
        .map(o => o.field)
        .filter(f => f !== sortBy);

    return (
        <>
            <PageShell
                backHref="/groups"
                title={group.name}
                subtitle={group.description || undefined}
                maxWidth="md"
                hasBottomNav
                headerRight={
                    <>
                        <button onClick={copyInviteCode} className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>
                            📋 {group.invite_code}
                        </button>
                        {isCreator && (
                            <button onClick={() => setShowEditModal(true)} className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>
                                ✏️ Edit
                            </button>
                        )}
                        <button onClick={handleLeaveGroup} className="btn btn-ghost" style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}>
                            Leave
                        </button>
                    </>
                }
            >
                <p className="text-dim" style={{ fontSize: '0.85rem', marginTop: '-16px', marginBottom: 'var(--space-xl)' }}>
                    {group.member_count} members
                </p>

                <Toast message={message} />

                {/* Sort Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
                    <span className="text-dim" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sort:</span>
                    {sortOptions.map(({ field, label, emoji }) => (
                        <button
                            key={field}
                            onClick={() => handleSort(field)}
                            className={`btn ${sortBy === field ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.65rem', padding: '0.35rem 0.5rem' }}
                        >
                            {emoji} {label} {sortBy === field && (sortAsc ? '↑' : '↓')}
                        </button>
                    ))}
                </div>

                {/* Leaderboard */}
                <section className="panel animate-slide-up">
                    <div className="panel-header">🏆 Leaderboard</div>

                    {sortedLeaderboard.length === 0 ? (
                        <p className="text-dim">No members yet</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {sortedLeaderboard.map((member, index) => {
                                const isMe = member.user_id === user.id;
                                const primaryStat = getStatDisplay(member, sortBy);

                                return (
                                    <div
                                        key={member.id}
                                        className="player-card"
                                        style={{
                                            borderColor: isMe ? 'rgba(244, 196, 48, 0.4)' : undefined,
                                            background: isMe ? 'rgba(244, 196, 48, 0.06)' : undefined,
                                            cursor: 'default',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                            {/* Rank */}
                                            <span
                                                className="font-bold font-data"
                                                style={{
                                                    color: index === 0 ? 'var(--accent-gold)' :
                                                        index === 1 ? '#c0c0c0' :
                                                            index === 2 ? '#cd7f32' : 'var(--text-muted)',
                                                    width: '1.5rem',
                                                    flexShrink: 0,
                                                    fontSize: '1rem',
                                                    textAlign: 'center',
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
                                                    gap: 'var(--space-sm)',
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <Avatar
                                                    userId={member.user_id}
                                                    username={member.username}
                                                    avatarColor={member.avatar_color}
                                                    size="sm"
                                                />
                                                <span
                                                    className="font-bold"
                                                    style={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: '0.9rem',
                                                    }}
                                                >
                                                    {member.username}
                                                    {isMe && <span className="text-accent-gold" style={{ fontSize: '0.7rem', marginLeft: '4px' }}>(You)</span>}
                                                </span>
                                            </Link>

                                            {/* Primary stat — always visible */}
                                            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '3.5rem' }}>
                                                <div
                                                    className="font-bold font-data"
                                                    style={{ color: primaryStat.color, fontSize: '0.9rem' }}
                                                >
                                                    {primaryStat.value}
                                                </div>
                                                <div className="text-dim" style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {getSortLabel(sortBy)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Secondary stats row */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(5, 1fr)',
                                            gap: 'var(--space-sm)',
                                            marginTop: 'var(--space-sm)',
                                            paddingTop: 'var(--space-sm)',
                                            borderTop: '1px solid var(--border-subtle)',
                                            textAlign: 'center',
                                        }}>
                                            {secondaryFields.map(field => {
                                                const stat = getStatDisplay(member, field);
                                                return (
                                                    <div key={field}>
                                                        <div className="font-bold font-data" style={{ color: stat.color, fontSize: '0.85rem' }}>
                                                            {stat.value}
                                                        </div>
                                                        <div className="text-dim" style={{ fontSize: '0.55rem', textTransform: 'uppercase' }}>
                                                            {getSortLabel(field)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Edit Modal */}
                {showEditModal && (
                    <Modal onClose={() => setShowEditModal(false)} title="Edit Group">
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <label className="label">Group Name</label>
                            <input
                                type="text"
                                className="input"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                            />
                        </div>

                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <label className="label">Description</label>
                            <input
                                type="text"
                                className="input"
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-sm">
                            <button onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editName.trim() || isSaving}
                                className="btn btn-primary flex-1"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </Modal>
                )}
            </PageShell>

            <BottomNav />
        </>
    );
}
