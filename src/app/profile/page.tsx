'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/scoring';
import { uploadAvatar, getAvatarUrl } from '@/lib/avatar';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import LoadingScreen from '@/components/LoadingScreen';
import Toast from '@/components/Toast';
import StatCard from '@/components/StatCard';

export default function Profile() {
    const { user, isLoading, userStats, sessions } = useApp();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        const loadAvatar = async () => {
            if (user) {
                const url = await getAvatarUrl(user.id);
                setAvatarUrl(url);
            }
        };
        loadAvatar();
    }, [user]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        setMessage(null);

        const result = await uploadAvatar(user.id, file);

        if (result.success && result.url) {
            setAvatarUrl(result.url + '?t=' + Date.now());
            setMessage({ type: 'success', text: 'Profile picture updated!' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Upload failed' });
        }

        setIsUploading(false);
        setTimeout(() => setMessage(null), 3000);
    };

    if (isLoading || !user) {
        return <LoadingScreen />;
    }

    const winRate = userStats && userStats.total_rounds_played > 0
        ? ((userStats.rounds_won / userStats.total_rounds_played) * 100).toFixed(1)
        : '0';

    const completedSessions = sessions.filter(s => s.status === 'completed');

    return (
        <>
            <PageShell backHref="/dashboard" maxWidth="md" hasBottomNav>
                {/* Profile Header */}
                <div className="flex items-center gap-4 animate-slide-up" style={{ marginBottom: 'var(--space-2xl)' }}>
                    {/* Avatar with upload */}
                    <div
                        onClick={handleAvatarClick}
                        className="player-avatar avatar-xl"
                        style={{
                            background: avatarUrl
                                ? `url(${avatarUrl}) center/cover`
                                : 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-red) 100%)',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {!avatarUrl && user.username.charAt(0)}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            padding: '3px',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {isUploading ? '...' : 'Edit'}
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <div>
                        <h1 className="text-title" style={{ fontSize: '1.75rem' }}>{user.username}</h1>
                        <p className="text-dim text-sm">{user.email}</p>
                    </div>
                </div>

                <Toast message={message} />

                {/* Lifetime Stats */}
                <section className="panel animate-slide-up" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="panel-header">Lifetime Statistics</div>

                    <div className="grid grid-cols-2 gap-md">
                        <StatCard
                            value={formatMoney(userStats?.lifetime_earnings || 0)}
                            label="Total Earnings"
                            color={(userStats?.lifetime_earnings || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
                        />
                        <StatCard value={`${winRate}%`} label="Win Rate" color="var(--accent-gold)" />
                        <StatCard value={`${userStats?.total_rounds_played || 0}`} label="Rounds Played" color="var(--accent-purple)" />
                        <StatCard value={`${userStats?.rounds_won || 0}`} label="Rounds Won" color="var(--accent-blue)" />
                        <StatCard value={`${userStats?.first_places || 0}`} label="First Places" color="var(--accent-gold)" />
                        <StatCard
                            value={
                                userStats && userStats.total_rounds_played > 0
                                    ? ((userStats.total_placement_sum || 0) / userStats.total_rounds_played).toFixed(1)
                                    : '-'
                            }
                            label="Avg Placement"
                            color="var(--text-secondary)"
                        />
                        <StatCard value={formatMoney(userStats?.best_session || 0)} label="Best Session" color="var(--accent-green)" />
                        <StatCard value={formatMoney(userStats?.worst_session || 0)} label="Worst Session" color="var(--accent-red)" />
                    </div>
                </section>

                {/* Session History */}
                <section className="panel animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="panel-header">Session History ({completedSessions.length})</div>

                    {completedSessions.length === 0 ? (
                        <p className="text-dim">No completed sessions yet</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: 320, overflowY: 'auto' }}>
                            {completedSessions.map(session => {
                                const userPlayer = session.players.find(p => p.user_id === user.id);
                                const earnings = userPlayer
                                    ? userPlayer.session_score * session.point_value
                                    : 0;

                                return (
                                    <Link
                                        key={session.id}
                                        href={`/session/${session.id}`}
                                        className="round-item"
                                    >
                                        <div>
                                            <span className="font-bold">
                                                {session.name || `Session ${session.id.slice(0, 8)}`}
                                            </span>
                                            <span className="text-dim" style={{ marginLeft: 'var(--space-sm)', fontSize: '0.85rem' }}>
                                                {session.rounds.length} rounds
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-bold font-data ${earnings > 0 ? 'text-positive' :
                                                earnings < 0 ? 'text-negative' : ''
                                                }`}>
                                                {formatMoney(earnings)}
                                            </span>
                                            <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                                                {new Date(session.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            </PageShell>

            <BottomNav />
        </>
    );
}
