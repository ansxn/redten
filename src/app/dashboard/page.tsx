'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Dashboard() {
    const { user, isLoading, sessions, signOut, userStats } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex-center">
                <div className="text-2xl text-glow" style={{ color: 'var(--accent-gold)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    const activeSessions = sessions.filter(s => s.status === 'active');
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const winRate = userStats && userStats.total_rounds_played > 0
        ? ((userStats.rounds_won / userStats.total_rounds_played) * 100).toFixed(1)
        : '0';

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container">
                {/* Header */}
                <header className="mobile-header mb-6 md:mb-8">
                    <div>
                        <img
                            src="/redtenlogo1.png"
                            alt="Red 10"
                            className="h-10 md:h-12 mb-2"
                        />
                        <p style={{ color: 'var(--text-secondary)' }} className="text-sm md:text-base">
                            Welcome back, <strong style={{ color: 'var(--accent-gold)' }}>{user.username}</strong>
                        </p>
                    </div>
                    <div className="btn-group-mobile">
                        <Link href="/groups" className="btn btn-secondary">
                            Groups
                        </Link>
                        <Link href="/friends" className="btn btn-secondary">
                            Friends
                        </Link>
                        <Link href="/profile" className="btn btn-secondary">
                            Profile
                        </Link>
                        <button onClick={signOut} className="btn btn-secondary">
                            Sign Out
                        </button>
                    </div>
                </header>

                {/* Stats Overview */}
                <section className="mb-8 animate-slide-up">
                    <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>
                        Your Stats
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                        <div className="stat-card">
                            <div
                                className="stat-value"
                                style={{
                                    color: (userStats?.lifetime_earnings || 0) >= 0
                                        ? 'var(--accent-green)'
                                        : 'var(--accent-red)'
                                }}
                            >
                                ${(userStats?.lifetime_earnings || 0).toFixed(2)}
                            </div>
                            <div className="stat-label">Lifetime Earnings</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>
                                {winRate}%
                            </div>
                            <div className="stat-label">Win Rate</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
                                {userStats?.total_rounds_played || 0}
                            </div>
                            <div className="stat-label">Rounds Played</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
                                {userStats?.sessions_played || 0}
                            </div>
                            <div className="stat-label">Sessions</div>
                        </div>
                    </div>
                </section>

                {/* Quick Actions */}
                <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <Link href="/session/new" className="btn btn-primary text-xl py-4 px-8">
                        + Start New Session
                    </Link>
                </section>

                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                    <section className="mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Active Sessions
                        </h2>
                        <div className="flex flex-col gap-md">
                            {activeSessions.map(session => (
                                <Link
                                    key={session.id}
                                    href={`/session/${session.id}`}
                                    className="panel hover:border-purple-500 transition-colors"
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-bold">
                                                {session.name || `Session ${session.id.slice(0, 8)}`}
                                            </h3>
                                            <p style={{ color: 'var(--text-muted)' }}>
                                                {session.players.length} players • {session.rounds.length} rounds
                                            </p>
                                        </div>
                                        <div className="btn btn-gold">Continue</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recent Sessions */}
                {completedSessions.length > 0 && (
                    <section className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Past Sessions
                        </h2>
                        <div className="flex flex-col gap-sm">
                            {completedSessions.slice(0, 5).map(session => (
                                <Link
                                    key={session.id}
                                    href={`/session/${session.id}`}
                                    className="round-item"
                                >
                                    <div>
                                        <span className="font-bold">
                                            {session.name || `Session ${session.id.slice(0, 8)}`}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', marginLeft: '1rem' }}>
                                            {session.rounds.length} rounds
                                        </span>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {new Date(session.created_at).toLocaleDateString()}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty State */}
                {sessions.length === 0 && (
                    <section className="text-center py-12 animate-fade-in">
                        <div className="text-6xl mb-4">🃏</div>
                        <h2 className="text-2xl font-bold mb-2">No Sessions Yet</h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Start your first game session to begin tracking scores!
                        </p>
                    </section>
                )}
            </div>
        </main>
    );
}
