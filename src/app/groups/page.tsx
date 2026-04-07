'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyGroups, createGroup, joinGroup, Group } from '@/lib/groups';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import LoadingScreen from '@/components/LoadingScreen';
import Toast from '@/components/Toast';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

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

    if (isLoading) return <LoadingScreen />;
    if (!user) return null;

    return (
        <>
            <PageShell
                backHref="/dashboard"
                title="Groups"
                subtitle="Create or join groups to compete on leaderboards"
                maxWidth="md"
                hasBottomNav
            >
                <Toast message={message} />

                {/* Action Buttons */}
                <div className="flex gap-sm flex-wrap" style={{ marginBottom: 'var(--space-xl)' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {[1, 2].map(i => <div key={i} className="skeleton skeleton-card" />)}
                        </div>
                    ) : groups.length === 0 ? (
                        <EmptyState
                            icon="👥"
                            title="No groups yet"
                            description="Create one or join with an invite code!"
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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
                                                <div className="text-dim" style={{ fontSize: '0.85rem' }}>
                                                    {group.description}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="text-accent-gold font-bold" style={{ fontSize: '0.9rem' }}>
                                                {group.member_count} members
                                            </div>
                                            <div className="text-dim font-data" style={{ fontSize: '0.7rem' }}>
                                                {group.invite_code}
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
                    <Modal onClose={() => setShowCreateModal(false)} title="Create Group">
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
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

                        <div style={{ marginBottom: 'var(--space-xl)' }}>
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
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || isCreating}
                                className="btn btn-primary flex-1"
                            >
                                {isCreating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </Modal>
                )}

                {/* Join Modal */}
                {showJoinModal && (
                    <Modal onClose={() => { setShowJoinModal(false); setJoinError(''); }} title="Join Group">
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <label className="label">Invite Code</label>
                            <input
                                type="text"
                                className="input text-center text-2xl tracking-widest font-data"
                                placeholder="ABC123"
                                value={inviteCode}
                                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        {joinError && (
                            <div className="toast toast-error" style={{ marginBottom: 'var(--space-lg)' }}>
                                {joinError}
                            </div>
                        )}

                        <div className="flex gap-sm">
                            <button onClick={() => { setShowJoinModal(false); setJoinError(''); }} className="btn btn-secondary flex-1">Cancel</button>
                            <button
                                onClick={handleJoinGroup}
                                disabled={inviteCode.length !== 6 || isJoining}
                                className="btn btn-primary flex-1"
                            >
                                {isJoining ? 'Joining...' : 'Join'}
                            </button>
                        </div>
                    </Modal>
                )}
            </PageShell>

            <BottomNav />
        </>
    );
}
