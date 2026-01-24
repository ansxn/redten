'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { getFriends, searchUsers, addFriend, removeFriend, Friend, UserProfile } from '@/lib/friends';
import Link from 'next/link';

export default function FriendsPage() {
    const { user, isLoading } = useApp();
    const router = useRouter();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        const loadFriends = async () => {
            if (user) {
                setIsLoadingFriends(true);
                const friendsList = await getFriends(user.id);
                setFriends(friendsList);
                setIsLoadingFriends(false);
            }
        };
        loadFriends();
    }, [user]);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !user) return;

        setIsSearching(true);
        const results = await searchUsers(searchQuery, user.id);
        // Filter out existing friends
        const friendIds = new Set(friends.map(f => f.id));
        setSearchResults(results.filter(r => !friendIds.has(r.id)));
        setIsSearching(false);
    };

    const handleAddFriend = async (friendProfile: UserProfile) => {
        if (!user) return;

        const success = await addFriend(user.id, friendProfile.id);
        if (success) {
            setFriends([...friends, {
                id: friendProfile.id,
                username: friendProfile.username,
                avatar_color: friendProfile.avatar_color || '#a855f7',
                created_at: new Date().toISOString()
            }]);
            setSearchResults(searchResults.filter(r => r.id !== friendProfile.id));
            setMessage({ type: 'success', text: `Added ${friendProfile.username} as a friend!` });
            setTimeout(() => setMessage(null), 3000);
        } else {
            setMessage({ type: 'error', text: 'Failed to add friend. Please try again.' });
        }
    };

    const handleRemoveFriend = async (friendId: string, username: string) => {
        if (!user) return;

        if (!confirm(`Remove ${username} from your friends?`)) return;

        const success = await removeFriend(user.id, friendId);
        if (success) {
            setFriends(friends.filter(f => f.id !== friendId));
            setMessage({ type: 'success', text: `Removed ${username} from friends.` });
            setTimeout(() => setMessage(null), 3000);
        } else {
            setMessage({ type: 'error', text: 'Failed to remove friend. Please try again.' });
        }
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
                    <h1 className="text-title text-2xl md:text-4xl">Friends</h1>
                    <p style={{ color: 'var(--text-secondary)' }} className="text-sm md:text-base">
                        Add friends to easily invite them to game sessions
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

                {/* Add Friend */}
                <section className="panel mb-6 animate-slide-up">
                    <div className="panel-header">Add Friend</div>

                    <div className="flex flex-col sm:flex-row gap-sm mb-4">
                        <input
                            type="text"
                            className="input flex-1"
                            placeholder="Search by username..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSearch}
                            disabled={isSearching || !searchQuery.trim()}
                        >
                            {isSearching ? '...' : 'Search'}
                        </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="flex flex-col gap-sm">
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                Search Results:
                            </p>
                            {searchResults.map(result => (
                                <div key={result.id} className="player-card">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/profile/${result.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                                <div
                                                    className="player-avatar"
                                                    style={{ background: result.avatar_color || '#a855f7' }}
                                                >
                                                    {result.username.charAt(0)}
                                                </div>
                                                <span className="font-bold underline decoration-dotted underline-offset-4">{result.username}</span>
                                            </Link>
                                        </div>
                                        <button
                                            className="btn btn-green"
                                            onClick={() => handleAddFriend(result)}
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {searchQuery && searchResults.length === 0 && !isSearching && (
                        <p style={{ color: 'var(--text-muted)' }}>
                            No users found matching &ldquo;{searchQuery}&rdquo;
                        </p>
                    )}
                </section>

                {/* Friends List */}
                <section className="panel animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="panel-header">
                        Your Friends ({friends.length})
                    </div>

                    {isLoadingFriends ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading friends...</p>
                    ) : friends.length === 0 ? (
                        <div className="text-center py-8">
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>👥</p>
                            <p style={{ color: 'var(--text-muted)' }}>
                                No friends yet. Search for users above to add them!
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {friends.map(friend => (
                                <div key={friend.id} className="player-card">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/profile/${friend.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                                <div
                                                    className="player-avatar"
                                                    style={{ background: friend.avatar_color }}
                                                >
                                                    {friend.username.charAt(0)}
                                                </div>
                                                <span className="font-bold underline decoration-dotted underline-offset-4">{friend.username}</span>
                                            </Link>
                                        </div>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => handleRemoveFriend(friend.id, friend.username)}
                                            style={{ color: 'var(--accent-red)' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
