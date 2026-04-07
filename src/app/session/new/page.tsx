'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { Session, SessionPlayer, generateId, getRandomAvatarColor } from '@/types';
import { getFriends, searchUsers, addFriend, Friend, UserProfile } from '@/lib/friends';
import * as db from '@/lib/database';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import Avatar from '@/components/Avatar';

interface SelectedPlayer {
    id: string;
    username: string;
    isGuest: boolean;
    userId?: string;
    avatarColor: string;
    isFriend: boolean;
}

export default function NewSession() {
    const { user, createSession, isGuestMode } = useApp();
    const router = useRouter();

    const [sessionName, setSessionName] = useState('');
    const [pointValue, setPointValue] = useState(1);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
    const [guestName, setGuestName] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
    const [showAllFriends, setShowAllFriends] = useState(false);

    useEffect(() => {
        const loadFriends = async () => {
            if (user) {
                try {
                    const friendsList = await getFriends(user.id);
                    setFriends(friendsList);
                } catch (e) {
                    console.error('Failed to load friends:', e);
                }
                setIsLoadingFriends(false);
            }
        };
        loadFriends();
    }, [user]);

    useEffect(() => {
        if (user && selectedPlayers.length === 0) {
            setSelectedPlayers([{
                id: generateId(),
                username: user.username,
                isGuest: false,
                userId: user.id,
                avatarColor: getRandomAvatarColor(),
                isFriend: false
            }]);
        }
    }, [user]);

    const handleUserSearch = async () => {
        if (!userSearch.trim() || !user) return;

        setIsSearching(true);
        const results = await searchUsers(userSearch, user.id);
        const selectedIds = new Set(selectedPlayers.map(p => p.userId).filter(Boolean));
        setSearchResults(results.filter(r => !selectedIds.has(r.id)));
        setIsSearching(false);
    };

    const addUserToSession = (profile: UserProfile) => {
        if (selectedPlayers.length >= 6) return;
        if (selectedPlayers.some(p => p.userId === profile.id)) return;

        const isFriend = friends.some(f => f.id === profile.id);

        setSelectedPlayers([...selectedPlayers, {
            id: generateId(),
            username: profile.username,
            isGuest: false,
            userId: profile.id,
            avatarColor: profile.avatar_color || getRandomAvatarColor(),
            isFriend
        }]);

        setSearchResults(searchResults.filter(r => r.id !== profile.id));
    };

    const addFriendToSession = (friend: Friend) => {
        if (selectedPlayers.length >= 6) return;
        if (selectedPlayers.some(p => p.userId === friend.id)) return;

        setSelectedPlayers([...selectedPlayers, {
            id: generateId(),
            username: friend.username,
            isGuest: false,
            userId: friend.id,
            avatarColor: friend.avatar_color,
            isFriend: true
        }]);
    };

    const addGuest = () => {
        if (selectedPlayers.length >= 6) return;
        if (!guestName.trim()) return;

        setSelectedPlayers([...selectedPlayers, {
            id: generateId(),
            username: guestName.trim(),
            isGuest: true,
            avatarColor: getRandomAvatarColor(),
            isFriend: false
        }]);
        setGuestName('');
    };

    const removePlayer = (playerId: string) => {
        const player = selectedPlayers.find(p => p.id === playerId);
        if (player?.userId === user?.id) return;
        setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
    };

    const handleAddAsFriend = async (player: SelectedPlayer) => {
        if (!user || !player.userId || player.isFriend) return;

        setAddingFriendId(player.userId);
        const success = await addFriend(user.id, player.userId);

        if (success) {
            setSelectedPlayers(selectedPlayers.map(p =>
                p.userId === player.userId ? { ...p, isFriend: true } : p
            ));
            setFriends([...friends, {
                id: player.userId,
                username: player.username,
                avatar_color: player.avatarColor,
                created_at: new Date().toISOString()
            }]);
        }
        setAddingFriendId(null);
    };

    const getDefaultSessionName = (): string => {
        const now = new Date();
        return now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const startSession = async () => {
        if (selectedPlayers.length !== 6 || !user) return;
        setIsCreating(true);

        const finalSessionName = sessionName.trim() || getDefaultSessionName();

        try {
            if (!isGuestMode) {
                const cloudSession = await db.createSession(
                    user.id,
                    finalSessionName,
                    pointValue,
                    selectedPlayers.map(p => ({
                        username: p.username,
                        isGuest: p.isGuest,
                        avatarColor: p.avatarColor,
                        userId: p.userId
                    }))
                );

                if (cloudSession) {
                    createSession(cloudSession);
                    router.push(`/session/${cloudSession.id}`);
                    return;
                }
            }

            const sessionPlayers: SessionPlayer[] = selectedPlayers.map(p => ({
                id: p.id,
                user_id: p.userId || null,
                username: p.username,
                session_score: 0,
                is_guest: p.isGuest,
                avatar_color: p.avatarColor
            }));

            const newSession: Session = {
                id: generateId(),
                created_at: new Date().toISOString(),
                created_by: user.id,
                players: sessionPlayers,
                rounds: [],
                status: 'active',
                point_value: pointValue,
                name: finalSessionName
            };

            createSession(newSession);
            router.push(`/session/${newSession.id}`);
        } catch (error) {
            console.error('Error creating session:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const availableFriends = friends.filter(
        f => !selectedPlayers.some(p => p.userId === f.id)
    );

    const playerCount = selectedPlayers.length;
    const remaining = 6 - playerCount;

    return (
        <>
            <PageShell backHref="/dashboard" title="New Session" maxWidth="md" hasBottomNav>
                {/* Session Settings */}
                <section className="panel animate-slide-up" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="panel-header">Session Settings</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        <div>
                            <label className="label">Session Name (optional)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Friday Night Game"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Point Value ($)</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                {[0.1, 0.25, 0.5, 1, 2, 5].map(value => (
                                    <button
                                        key={value}
                                        className={`btn ${pointValue === value ? 'btn-gold' : 'btn-secondary'}`}
                                        onClick={() => setPointValue(value)}
                                    >
                                        ${value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Selected Players */}
                <section className="panel animate-slide-up" style={{ animationDelay: '0.1s', marginBottom: 'var(--space-xl)' }}>
                    <div className="panel-header">
                        Players ({playerCount}/6)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {selectedPlayers.map((player) => (
                            <div key={player.id} className="player-card">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-sm">
                                        <Avatar
                                            userId={player.userId}
                                            username={player.username}
                                            avatarColor={player.avatarColor}
                                            size="sm"
                                        />
                                        <div>
                                            <div className="font-bold" style={{ fontSize: '0.9rem' }}>{player.username}</div>
                                            <div style={{
                                                color: player.isGuest ? 'var(--text-muted)' : 'var(--accent-green)',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                            }}>
                                                {player.userId === user?.id
                                                    ? 'You'
                                                    : player.isGuest
                                                        ? 'Guest'
                                                        : player.isFriend
                                                            ? '★ Friend'
                                                            : 'User'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-sm">
                                        {!player.isGuest && !player.isFriend && player.userId !== user?.id && (
                                            <button
                                                onClick={() => handleAddAsFriend(player)}
                                                disabled={addingFriendId === player.userId}
                                                className="btn btn-ghost"
                                                style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', color: 'var(--accent-gold)' }}
                                            >
                                                {addingFriendId === player.userId ? '...' : '+ Friend'}
                                            </button>
                                        )}
                                        {player.userId !== user?.id && (
                                            <button
                                                onClick={() => removePlayer(player.id)}
                                                className="btn btn-ghost btn-icon"
                                                style={{ color: 'var(--accent-red)', fontSize: '1.1rem', padding: '0.2rem' }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Search Users */}
                {playerCount < 6 && (
                    <section className="panel animate-slide-up" style={{ animationDelay: '0.2s', marginBottom: 'var(--space-xl)' }}>
                        <div className="panel-header">Search Users</div>
                        <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
                            <input
                                type="text"
                                className="input flex-1"
                                placeholder="Search by username..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleUserSearch}
                                disabled={isSearching || !userSearch.trim()}
                            >
                                {isSearching ? '...' : 'Search'}
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {searchResults.map(result => (
                                    <div
                                        key={result.id}
                                        className="player-card"
                                        onClick={() => addUserToSession(result)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="flex items-center gap-sm">
                                            <Avatar
                                                userId={result.id}
                                                username={result.username}
                                                avatarColor={result.avatar_color || '#a855f7'}
                                                size="sm"
                                            />
                                            <span className="font-bold" style={{ fontSize: '0.9rem' }}>{result.username}</span>
                                            {friends.some(f => f.id === result.id) && (
                                                <span className="text-accent-gold" style={{ fontSize: '0.7rem' }}>★ Friend</span>
                                            )}
                                            <span className="text-positive" style={{ marginLeft: 'auto', fontSize: '1.1rem' }}>+</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Quick Add Friends */}
                {playerCount < 6 && availableFriends.length > 0 && (
                    <section className="panel animate-slide-up" style={{ animationDelay: '0.25s', marginBottom: 'var(--space-xl)' }}>
                        <div className="panel-header">Quick Add Friends</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                            {(showAllFriends ? availableFriends : availableFriends.slice(0, 5)).map(friend => (
                                <button
                                    key={friend.id}
                                    className="btn btn-secondary"
                                    onClick={() => addFriendToSession(friend)}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    + {friend.username}
                                </button>
                            ))}
                            {availableFriends.length > 5 && (
                                <button
                                    onClick={() => setShowAllFriends(!showAllFriends)}
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    {showAllFriends ? 'Show less' : `+${availableFriends.length - 5} more`}
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {/* Add Guest */}
                {playerCount < 6 && (
                    <section className="panel animate-slide-up" style={{ animationDelay: '0.3s', marginBottom: 'var(--space-xl)' }}>
                        <div className="panel-header">Add Guest</div>
                        <p className="text-dim" style={{ fontSize: '0.8rem', marginBottom: 'var(--space-md)' }}>
                            Guests don&apos;t have accounts — their stats won&apos;t be tracked.
                        </p>
                        <div className="flex gap-sm">
                            <input
                                type="text"
                                className="input flex-1"
                                placeholder="Guest name..."
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={addGuest}
                                disabled={!guestName.trim()}
                            >
                                Add Guest
                            </button>
                        </div>
                    </section>
                )}

                {/* Start Button */}
                <button
                    className={`btn ${playerCount === 6 ? 'btn-primary btn-cta-glow' : 'btn-secondary'} w-full text-xl py-4`}
                    onClick={startSession}
                    disabled={playerCount !== 6 || isCreating}
                >
                    {isCreating
                        ? 'Creating...'
                        : playerCount === 6
                            ? 'Start Game'
                            : `Need ${remaining} more player${remaining === 1 ? '' : 's'}`
                    }
                </button>

                {playerCount !== 6 && (
                    <p className="text-center text-accent-gold" style={{ marginTop: 'var(--space-lg)', fontSize: '0.85rem' }}>
                        Add exactly 6 players to start ({playerCount}/6)
                    </p>
                )}
            </PageShell>

            <BottomNav />
        </>
    );
}
