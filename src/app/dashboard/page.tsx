'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import StatCard from '@/components/StatCard';

export default function Dashboard() {
    const { user, isLoading, sessions, signOut, userStats } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user) {
        return <LoadingScreen />;
    }

    const activeSessions = sessions.filter(s => s.status === 'active');
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const winRate = userStats && userStats.total_rounds_played > 0
        ? ((userStats.rounds_won / userStats.total_rounds_played) * 100).toFixed(1)
        : '0';

    return (
        <>
            <main className="min-h-screen p-4 md:p-8 has-bottom-nav">
                <div className="container">
                    {/* Header */}
                    <header className="mobile-header" style={{ marginBottom: 'var(--space-2xl)' }}>
                        <div>
                            <img
                                src="/redtenlogo1.png"
                                alt="Red 10"
                                className="h-10 md:h-12"
                                style={{ marginBottom: 'var(--space-sm)' }}
                            />
                            <p className="text-sub text-sm md:text-base">
                                Welcome back, <strong className="text-accent-gold">{user.username}</strong>
                            </p>
                        </div>
                        <div className="desktop-nav" style={{ alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <BottomNav variant="desktop" />
                            <button onClick={signOut} className="nav-item" style={{ color: 'var(--accent-red)' }}>
                                Sign Out
                            </button>
                        </div>
                    </header>

                    {/* Stats Overview */}
                    <section className="animate-slide-up" style={{ marginBottom: 'var(--space-2xl)' }}>
                        <h2 className="text-sub font-bold" style={{ marginBottom: 'var(--space-lg)' }}>
                            Your Stats
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                            <StatCard
                                value={`$${(userStats?.lifetime_earnings || 0).toFixed(2)}`}
                                label="Lifetime Earnings"
                                color={(userStats?.lifetime_earnings || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
                            />
                            <StatCard
                                value={`${winRate}%`}
                                label="Win Rate"
                                color="var(--accent-gold)"
                            />
                            <StatCard
                                value={`${userStats?.total_rounds_played || 0}`}
                                label="Rounds Played"
                                color="var(--accent-purple)"
                            />
                            <StatCard
                                value={`${completedSessions.length}`}
                                label="Sessions"
                                color="var(--accent-blue)"
                            />
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="animate-slide-up" style={{ animationDelay: '0.1s', marginBottom: 'var(--space-2xl)' }}>
                        <Link href="/session/new" className="btn btn-primary btn-cta-glow text-xl py-4 px-8">
                            + Start New Session
                        </Link>
                    </section>

                    {/* Active Sessions */}
                    {activeSessions.length > 0 && (
                        <section className="animate-slide-up" style={{ animationDelay: '0.2s', marginBottom: 'var(--space-2xl)' }}>
                            <h2 className="text-sub font-bold" style={{ marginBottom: 'var(--space-lg)' }}>
                                Active Sessions
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                {activeSessions.map(session => (
                                    <Link
                                        key={session.id}
                                        href={`/session/${session.id}`}
                                        className="panel"
                                        style={{ cursor: 'pointer', transition: 'border-color var(--transition-fast)' }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-lg font-bold">
                                                    {session.name || `Session ${session.id.slice(0, 8)}`}
                                                </h3>
                                                <p className="text-dim text-sm">
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
                            <h2 className="text-sub font-bold" style={{ marginBottom: 'var(--space-lg)' }}>
                                Past Sessions
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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
                                            <span className="text-dim" style={{ marginLeft: 'var(--space-lg)', fontSize: '0.875rem' }}>
                                                {session.rounds.length} rounds
                                            </span>
                                        </div>
                                        <span className="text-dim text-sm">
                                            {new Date(session.created_at).toLocaleDateString()}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Empty State */}
                    {sessions.length === 0 && (
                        <EmptyState
                            icon="🃏"
                            title="No Sessions Yet"
                            description="Start your first game session to begin tracking scores!"
                            action={
                                <Link href="/session/new" className="btn btn-primary">
                                    Start First Session
                                </Link>
                            }
                        />
                    )}
                </div>
            </main>

            {/* Mobile bottom nav */}
            <BottomNav />
        </>
    );
}
