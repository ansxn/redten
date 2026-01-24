'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyGroups, createGroup, joinGroup, Group } from '@/lib/groups';

export default function GroupsPage() {
    const { user, isLoading } = useApp();
    const router = useRouter();

    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    // Create form
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Join form
    const [inviteCode, setInviteCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState('');

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        const loadGroups = async () => {
            if (user) {
                setIsLoadingGroups(true);
                const myGroups = await getMyGroups(user.id);
                setGroups(myGroups);
                setIsLoadingGroups(false);
            }
        };
        loadGroups();
    }, [user]);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || !user) return;
        setIsCreating(true);

        const group = await createGroup(user.id, newGroupName.trim(), newGroupDesc.trim() || undefined);

        if (group) {
            setGroups([...groups, group]);
            setMessage({ type: 'success', text: `Group "${group.name}" created! Invite code: ${group.invite_code}` });
            setShowCreateModal(false);
            setNewGroupName('');
            setNewGroupDesc('');
        } else {
            setMessage({ type: 'error', text: 'Failed to create group' });
        }

        setIsCreating(false);
        setTimeout(() => setMessage(null), 5000);
    };

    const handleJoinGroup = async () => {
        if (!inviteCode.trim() || !user) return;
        setIsJoining(true);
        setJoinError('');

        const result = await joinGroup(user.id, inviteCode.trim());

        if (result.success && result.group) {
            setGroups([...groups, result.group]);
            setMessage({ type: 'success', text: `Joined "${result.group.name}"!` });
            setShowJoinModal(false);
            setInviteCode('');
        } else {
            setJoinError(result.error || 'Failed to join');
        }

        setIsJoining(false);
        setTimeout(() => setMessage(null), 3000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex-center">
                <div className="text-2xl text-glow" style={{ color: 'var(--accent-gold)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container max-w-2xl">
                {/* Header */}
                <header className="mb-6 md:mb-8">
                    <Link href="/dashboard" className="btn btn-secondary mb-4">
                        ← Back
                    </Link>
                    <h1 className="text-title text-2xl md:text-4xl">Groups</h1>
                    <p style={{ color: 'var(--text-secondary)' }} className="text-sm md:text-base">
                        Create or join groups to compete on leaderboards
                    </p>
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

                {/* Action Buttons */}
                <div className="flex gap-sm mb-6 flex-wrap">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary flex-1"
                    >
                        + Create Group
                    </button>
                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="btn btn-secondary flex-1"
                    >
                        Join with Code
                    </button>
                </div>

                {/* Groups List */}
                <section className="panel animate-slide-up">
                    <div className="panel-header">
                        Your Groups ({groups.length})
                    </div>

                    {isLoadingGroups ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading groups...</p>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-8">
                            <p style={{ color: 'var(--text-muted)', fontSize: '2rem' }}>👥</p>
                            <p style={{ color: 'var(--text-muted)' }}>
                                No groups yet. Create one or join with an invite code!
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {groups.map(group => (
                                <Link
                                    key={group.id}
                                    href={`/groups/${group.id}`}
                                    className="player-card"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-lg">{group.name}</div>
                                            {group.description && (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                    {group.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                                {group.member_count} members
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                Code: {group.invite_code}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/70 flex-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
                        <div className="panel w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="panel-header">Create Group</div>

                            <div className="mb-4">
                                <label className="label">Group Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Friday Night Poker"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="mb-6">
                                <label className="label">Description (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Weekly games with the crew"
                                    value={newGroupDesc}
                                    onChange={e => setNewGroupDesc(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-sm">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!newGroupName.trim() || isCreating}
                                    className="btn btn-primary flex-1"
                                >
                                    {isCreating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Join Modal */}
                {showJoinModal && (
                    <div className="fixed inset-0 bg-black/70 flex-center p-4 z-50" onClick={() => setShowJoinModal(false)}>
                        <div className="panel w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="panel-header">Join Group</div>

                            <div className="mb-4">
                                <label className="label">Invite Code</label>
                                <input
                                    type="text"
                                    className="input text-center text-2xl tracking-widest"
                                    placeholder="ABC123"
                                    value={inviteCode}
                                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>

                            {joinError && (
                                <div className="mb-4 text-center" style={{ color: 'var(--accent-red)' }}>
                                    {joinError}
                                </div>
                            )}

                            <div className="flex gap-sm">
                                <button
                                    onClick={() => { setShowJoinModal(false); setJoinError(''); }}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleJoinGroup}
                                    disabled={inviteCode.length !== 6 || isJoining}
                                    className="btn btn-primary flex-1"
                                >
                                    {isJoining ? 'Joining...' : 'Join'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
