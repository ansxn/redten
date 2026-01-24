'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/scoring';
import { getAvatarUrl } from '@/lib/avatar';
import { getUserProfile, getOrCreateUserStats, getUserSessions } from '@/lib/database';
import { User, UserStats, Session } from '@/types';

export default function PublicProfile() {
    const { user, isLoading: appLoading } = useApp();
    const params = useParams();
    const router = useRouter();

    const profileId = params.id as string;

    const [profile, setProfile] = useState<User | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Redirect if viewing own profile
    useEffect(() => {
        if (user && user.id === profileId) {
            router.push('/profile');
        }
    }, [user, profileId, router]);

    // Fetch public profile data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [userProfile, userStats, userSessions, avatar] = await Promise.all([
                    getUserProfile(profileId),
                    getOrCreateUserStats(profileId),
                    getUserSessions(profileId),
                    getAvatarUrl(profileId)
                ]);

                setProfile(userProfile);
                setStats(userStats);
                setSessions(userSessions);
                setAvatarUrl(avatar);
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (profileId) {
            loadData();
        }
    }, [profileId]);

    if (appLoading || isLoading) {
        return (
            <div className="min-h-screen flex-center">
                <div className="text-2xl text-glow" style={{ color: 'var(--accent-gold)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex-center flex-col gap-4">
                <div className="text-2xl">User not found</div>
                <Link href="/dashboard" className="btn btn-secondary">Go to Dashboard</Link>
            </div>
        );
    }

    const winRate = stats && stats.total_rounds_played > 0
        ? ((stats.rounds_won / stats.total_rounds_played) * 100).toFixed(1)
        : '0';

    const completedSessions = sessions.filter(s => s.status === 'completed');

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container max-w-2xl">
                {/* Header */}
                <header className="mb-6 md:mb-8">
                    <button onClick={() => router.back()} className="btn btn-secondary mb-4">
                        ← Back
                    </button>
                    <div className="flex items-center gap-3 md:gap-4">
                        {/* Avatar (Read-only) */}
                        <div
                            className="player-avatar"
                            style={{
                                width: 80,
                                height: 80,
                                fontSize: '2rem',
                                background: avatarUrl
                                    ? `url(${avatarUrl}) center/cover`
                                    : 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-red) 100%)'
                            }}
                        >
                            {!avatarUrl && profile.username.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-title text-3xl">{profile.username}</h1>
                            {/* Hide email for privacy on public profiles */}
                            <p style={{ color: 'var(--text-muted)' }}>Player since {new Date(profile.created_at).getFullYear()}</p>
                        </div>
                    </div>
                </header>

                {/* Lifetime Stats */}
                <section className="panel mb-6 animate-slide-up">
                    <div className="panel-header">Lifetime Statistics</div>

                    <div className="grid grid-cols-2 gap-md">
                        <div className="stat-card">
                            <div
                                className="stat-value"
                                style={{
                                    color: (stats?.lifetime_earnings || 0) >= 0
                                        ? 'var(--accent-green)'
                                        : 'var(--accent-red)'
                                }}
                            >
                                {formatMoney(stats?.lifetime_earnings || 0)}
                            </div>
                            <div className="stat-label">Total Earnings</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>
                                {winRate}%
                            </div>
                            <div className="stat-label">Win Rate</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
                                {stats?.total_rounds_played || 0}
                            </div>
                            <div className="stat-label">Rounds Played</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
                                {stats?.rounds_won || 0}
                            </div>
                            <div className="stat-label">Rounds Won</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>
                                {stats?.first_places || 0}
                            </div>
                            <div className="stat-label">First Places</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>
                                {stats && stats.total_rounds_played > 0
                                    ? ((stats.total_placement_sum || 0) / stats.total_rounds_played).toFixed(1)
                                    : '-'}
                            </div>
                            <div className="stat-label">Avg Placement</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
                                {formatMoney(stats?.best_session || 0)}
                            </div>
                            <div className="stat-label">Best Session</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                {formatMoney(stats?.worst_session || 0)}
                            </div>
                            <div className="stat-label">Worst Session</div>
                        </div>
                    </div>
                </section>

                {/* Session History */}
                <section className="panel animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="panel-header">Session History ({sessions.length})</div>

                    {completedSessions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No completed sessions yet</p>
                    ) : (
                        <div className="flex flex-col gap-sm max-h-80 overflow-y-auto">
                            {completedSessions.map(session => {
                                const userPlayer = session.players.find(p => p.username === profile.username || p.user_id === profile.id);
                                const earnings = userPlayer
                                    ? userPlayer.session_score * session.point_value
                                    : 0;

                                return (
                                    <div
                                        key={session.id}
                                        className="round-item"
                                    >
                                        <div>
                                            <span className="font-bold">
                                                {session.name || `Session ${session.id.slice(0, 8)}`}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                                {session.rounds.length} rounds
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-bold ${earnings > 0 ? 'text-green-400' :
                                                earnings < 0 ? 'text-red-400' : ''
                                                }`}>
                                                {formatMoney(earnings)}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {new Date(session.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
