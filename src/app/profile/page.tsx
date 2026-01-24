'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/scoring';
import { uploadAvatar, getAvatarUrl } from '@/lib/avatar';

export default function Profile() {
    const { user, isLoading, userStats, sessions } = useApp();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/');
        }
    }, [user, isLoading, router]);

    // Load avatar URL
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
        setUploadMessage(null);

        const result = await uploadAvatar(user.id, file);

        if (result.success && result.url) {
            setAvatarUrl(result.url + '?t=' + Date.now()); // Cache bust
            setUploadMessage({ type: 'success', text: 'Profile picture updated!' });
        } else {
            setUploadMessage({ type: 'error', text: result.error || 'Upload failed' });
        }

        setIsUploading(false);
        setTimeout(() => setUploadMessage(null), 3000);
    };

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex-center">
                <div className="text-2xl text-glow" style={{ color: 'var(--accent-gold)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    const winRate = userStats && userStats.total_rounds_played > 0
        ? ((userStats.rounds_won / userStats.total_rounds_played) * 100).toFixed(1)
        : '0';

    const completedSessions = sessions.filter(s => s.status === 'completed');

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container max-w-2xl">
                {/* Header */}
                <header className="mb-6 md:mb-8">
                    <Link href="/dashboard" className="btn btn-secondary mb-4">
                        ← Back
                    </Link>
                    <div className="flex items-center gap-3 md:gap-4">
                        {/* Avatar with upload */}
                        <div
                            onClick={handleAvatarClick}
                            className="player-avatar"
                            style={{
                                width: 80,
                                height: 80,
                                fontSize: '2rem',
                                background: avatarUrl
                                    ? `url(${avatarUrl}) center/cover`
                                    : 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-red) 100%)',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {!avatarUrl && user.username.charAt(0)}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                fontSize: '0.6rem',
                                padding: '2px',
                                textAlign: 'center'
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
                            <h1 className="text-title text-3xl">{user.username}</h1>
                            <p style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                        </div>
                    </div>

                    {/* Upload Message */}
                    {uploadMessage && (
                        <div
                            className="mt-4 p-3 rounded-lg text-center"
                            style={{
                                background: uploadMessage.type === 'success'
                                    ? 'rgba(74, 222, 128, 0.2)'
                                    : 'rgba(231, 76, 76, 0.2)',
                                color: uploadMessage.type === 'success'
                                    ? 'var(--accent-green)'
                                    : 'var(--accent-red)'
                            }}
                        >
                            {uploadMessage.text}
                        </div>
                    )}
                </header>

                {/* Lifetime Stats */}
                <section className="panel mb-6 animate-slide-up">
                    <div className="panel-header">Lifetime Statistics</div>

                    <div className="grid grid-cols-2 gap-md">
                        <div className="stat-card">
                            <div
                                className="stat-value"
                                style={{
                                    color: (userStats?.lifetime_earnings || 0) >= 0
                                        ? 'var(--accent-green)'
                                        : 'var(--accent-red)'
                                }}
                            >
                                {formatMoney(userStats?.lifetime_earnings || 0)}
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
                                {userStats?.total_rounds_played || 0}
                            </div>
                            <div className="stat-label">Rounds Played</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
                                {userStats?.rounds_won || 0}
                            </div>
                            <div className="stat-label">Rounds Won</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
                                {formatMoney(userStats?.best_session || 0)}
                            </div>
                            <div className="stat-label">Best Session</div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                {formatMoney(userStats?.worst_session || 0)}
                            </div>
                            <div className="stat-label">Worst Session</div>
                        </div>
                    </div>
                </section>

                {/* Session History */}
                <section className="panel animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="panel-header">Session History ({userStats?.sessions_played || 0})</div>

                    {completedSessions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No completed sessions yet</p>
                    ) : (
                        <div className="flex flex-col gap-sm max-h-80 overflow-y-auto">
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
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
