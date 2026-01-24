'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { Session, SessionPlayer, generateId, getRandomAvatarColor } from '@/types';
import { getFriends, searchUsers, addFriend, Friend, UserProfile } from '@/lib/friends';
import * as db from '@/lib/database';
import Link from 'next/link';

interface SelectedPlayer {
    id: string;
    username: string;
    isGuest: boolean;
    userId?: string;  // Real user ID if not a guest
    avatarColor: string;
    isFriend: boolean;  // Whether they're already a friend
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

    // Load friends list
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

    // Add current user automatically
    useEffect(() => {
        if (user && selectedPlayers.length === 0) {
            setSelectedPlayers([{
                id: generateId(),
                username: user.username,
                isGuest: false,
                userId: user.id,
                avatarColor: getRandomAvatarColor(),
                isFriend: false  // You're not your own friend
            }]);
        }
    }, [user]);

    const handleUserSearch = async () => {
        if (!userSearch.trim() || !user) return;

        setIsSearching(true);
        const results = await searchUsers(userSearch, user.id);
        // Filter out already selected players
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

        // Remove from search results
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
            // Update player to show as friend
            setSelectedPlayers(selectedPlayers.map(p =>
                p.userId === player.userId ? { ...p, isFriend: true } : p
            ));
            // Add to friends list
            setFriends([...friends, {
                id: player.userId,
                username: player.username,
                avatar_color: player.avatarColor,
                created_at: new Date().toISOString()
            }]);
        }
        setAddingFriendId(null);
    };

    // Generate default session name from date/time
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
                user_id: p.userId || p.id,
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

    // Available friends (not already in session)
    const availableFriends = friends.filter(
        f => !selectedPlayers.some(p => p.userId === f.id)
    );

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container max-w-2xl">
                {/* Header */}
                <header className="mb-6 md:mb-8">
                    <Link href="/dashboard" className="btn btn-secondary mb-4">
                        ← Back
                    </Link>
                    <h1 className="text-title text-2xl md:text-4xl">New Session</h1>
                </header>

                {/* Session Settings */}
                <section className="panel mb-6 animate-slide-up">
                    <div className="panel-header">Session Settings</div>
                    <div className="flex flex-col gap-md">
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
                            <div className="flex gap-sm flex-wrap">
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
                <section className="panel mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="panel-header">
                        Players ({selectedPlayers.length}/6)
                    </div>
                    <div className="flex flex-col gap-sm">
                        {selectedPlayers.map((player) => (
                            <div key={player.id} className="player-card">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-sm">
                                        <div
                                            className="player-avatar"
                                            style={{
                                                width: 36,
                                                height: 36,
                                                fontSize: '0.875rem',
                                                background: player.avatarColor
                                            }}
                                        >
                                            {player.username.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold">{player.username}</div>
                                            <div style={{
                                                color: player.isGuest ? 'var(--text-muted)' : 'var(--accent-green)',
                                                fontSize: '0.75rem'
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
                                        {/* Add as Friend button for non-friends */}
                                        {!player.isGuest && !player.isFriend && player.userId !== user?.id && (
                                            <button
                                                onClick={() => handleAddAsFriend(player)}
                                                disabled={addingFriendId === player.userId}
                                                className="btn btn-secondary"
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                            >
                                                {addingFriendId === player.userId ? '...' : '+ Friend'}
                                            </button>
                                        )}
                                        {player.userId !== user?.id && (
                                            <button
                                                onClick={() => removePlayer(player.id)}
                                                style={{
                                                    color: 'var(--accent-red)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '1.25rem'
                                                }}
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
                {selectedPlayers.length < 6 && (
                    <section className="panel mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="panel-header">Search Users</div>
                        <div className="flex gap-sm mb-4">
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
                            <div className="flex flex-col gap-sm">
                                {searchResults.map(result => (
                                    <div
                                        key={result.id}
                                        className="player-card"
                                        onClick={() => addUserToSession(result)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="flex items-center gap-sm">
                                            <div
                                                className="player-avatar"
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    fontSize: '0.875rem',
                                                    background: result.avatar_color || '#a855f7'
                                                }}
                                            >
                                                {result.username.charAt(0)}
                                            </div>
                                            <span className="font-bold">{result.username}</span>
                                            {friends.some(f => f.id === result.id) && (
                                                <span style={{ color: 'var(--accent-gold)', fontSize: '0.75rem' }}>★ Friend</span>
                                            )}
                                            <span style={{
                                                marginLeft: 'auto',
                                                color: 'var(--accent-green)',
                                                fontSize: '1.25rem'
                                            }}>+</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Quick Add Friends */}
                {selectedPlayers.length < 6 && availableFriends.length > 0 && (
                    <section className="panel mb-6 animate-slide-up" style={{ animationDelay: '0.25s' }}>
                        <div className="panel-header">Quick Add Friends</div>
                        <div className="flex flex-wrap gap-sm">
                            {availableFriends.slice(0, 5).map(friend => (
                                <button
                                    key={friend.id}
                                    className="btn btn-secondary"
                                    onClick={() => addFriendToSession(friend)}
                                    style={{ fontSize: '0.875rem' }}
                                >
                                    + {friend.username}
                                </button>
                            ))}
                            {availableFriends.length > 5 && (
                                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>
                                    +{availableFriends.length - 5} more
                                </span>
                            )}
                        </div>
                    </section>
                )}

                {/* Add Guest */}
                {selectedPlayers.length < 6 && (
                    <section className="panel mb-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <div className="panel-header">Add Guest</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            Guests don&apos;t have accounts - their stats won&apos;t be tracked.
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
                    className="btn btn-primary w-full text-xl py-4"
                    onClick={startSession}
                    disabled={selectedPlayers.length !== 6 || isCreating}
                >
                    {isCreating
                        ? 'Creating...'
                        : selectedPlayers.length === 6
                            ? 'Start Game'
                            : `Need ${6 - selectedPlayers.length} more player${6 - selectedPlayers.length === 1 ? '' : 's'}`
                    }
                </button>

                {selectedPlayers.length !== 6 && (
                    <p className="text-center mt-4" style={{ color: 'var(--accent-gold)' }}>
                        Add exactly 6 players to start ({selectedPlayers.length}/6)
                    </p>
                )}
            </div>
        </main>
    );
}
