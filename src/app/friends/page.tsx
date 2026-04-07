'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { getFriends, searchUsers, addFriend, removeFriend, Friend, UserProfile } from '@/lib/friends';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import LoadingScreen from '@/components/LoadingScreen';
import Toast from '@/components/Toast';
import EmptyState from '@/components/EmptyState';

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

    if (isLoading) return <LoadingScreen />;
    if (!user) return null;

    return (
        <>
            <PageShell
                backHref="/dashboard"
                title="Friends"
                subtitle="Add friends to easily invite them to game sessions"
                maxWidth="md"
                hasBottomNav
            >
                <Toast message={message} />

                {/* Add Friend */}
                <section className="panel animate-slide-up" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="panel-header">Add Friend</div>

                    <div className="flex flex-col sm:flex-row gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            <p className="text-dim" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Search Results
                            </p>
                            {searchResults.map(result => (
                                <div key={result.id} className="player-card">
                                    <div className="flex justify-between items-center">
                                        <Link href={`/profile/${result.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                            <Avatar
                                                userId={result.id}
                                                username={result.username}
                                                avatarColor={result.avatar_color || '#a855f7'}
                                                size="sm"
                                            />
                                            <span className="font-bold">{result.username}</span>
                                        </Link>
                                        <button
                                            className="btn btn-green"
                                            onClick={() => handleAddFriend(result)}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {searchQuery && searchResults.length === 0 && !isSearching && (
                        <p className="text-dim">
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" />)}
                        </div>
                    ) : friends.length === 0 ? (
                        <EmptyState
                            icon="👥"
                            title="No friends yet"
                            description="Search for users above to add them!"
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {friends.map(friend => (
                                <div key={friend.id} className="player-card">
                                    <div className="flex justify-between items-center">
                                        <Link href={`/profile/${friend.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                            <Avatar
                                                userId={friend.id}
                                                username={friend.username}
                                                avatarColor={friend.avatar_color}
                                                size="sm"
                                            />
                                            <span className="font-bold">{friend.username}</span>
                                        </Link>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => handleRemoveFriend(friend.id, friend.username)}
                                            style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </PageShell>

            <BottomNav />
        </>
    );
}
