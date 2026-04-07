'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

export default function Home() {
    const { user, isLoading, signIn, signUp, resetPassword } = useApp();
    const router = useRouter();
    const [mode, setMode] = useState<'signup' | 'signin' | 'forgot'>('signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if already logged in
    useEffect(() => {
        if (!isLoading && user) {
            router.push('/dashboard');
        }
    }, [user, isLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (mode === 'signup') {
                if (!username.trim()) {
                    setError('Username is required');
                    setLoading(false);
                    return;
                }
                if (!email.trim() || !password.trim()) {
                    setError('Email and password are required');
                    setLoading(false);
                    return;
                }
                const { error } = await signUp(email, password, username);
                if (error) {
                    setError(error);
                } else {
                    setSuccess('Account created! Check your email to confirm, then sign in.');
                    setMode('signin');
                }
            } else if (mode === 'signin') {
                if (!email.trim() || !password.trim()) {
                    setError('Email and password are required');
                    setLoading(false);
                    return;
                }
                const { error } = await signIn(email, password);
                if (error) {
                    setError(error);
                }
            } else if (mode === 'forgot') {
                if (!email.trim()) {
                    setError('Email is required');
                    setLoading(false);
                    return;
                }
                const { error } = await resetPassword(email);
                if (error) {
                    setError(error);
                } else {
                    setSuccess('Password reset email sent! Check your inbox.');
                }
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    // Don't flash the form while redirecting
    if (user) {
        return <LoadingScreen />;
    }

    const modeLabels = {
        signup: 'Create Account',
        signin: 'Sign In',
        forgot: 'Reset Password',
    };

    const switchMode = (newMode: 'signup' | 'signin' | 'forgot') => {
        setMode(newMode);
        setError('');
        setSuccess('');
    };

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
            {/* Logo */}
            <div className="text-center animate-slide-up" style={{ marginBottom: 'var(--space-3xl)' }}>
                <img
                    src="/redtenlogo1.png"
                    alt="Red 10"
                    className="h-14 md:h-20 mx-auto"
                    style={{ marginBottom: 'var(--space-md)' }}
                />
                <p className="text-sub text-base md:text-lg">
                    Tracker for TAW&apos;s favourite card game
                </p>
            </div>

            {/* Auth Panel */}
            <div className="panel w-full max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
                {/* Mode Tabs */}
                <div
                    style={{
                        display: 'flex',
                        gap: 'var(--space-xs)',
                        marginBottom: 'var(--space-xl)',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-xs)',
                    }}
                >
                    {(['signin', 'signup'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => switchMode(m)}
                            style={{
                                flex: 1,
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                transition: 'all 150ms ease',
                                background: mode === m ? 'var(--bg-card-solid)' : 'transparent',
                                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                            }}
                        >
                            {m === 'signin' ? 'Sign In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {mode === 'signup' && (
                        <div>
                            <label className="label">Username</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Your display name"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="label">Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {mode !== 'forgot' && (
                        <div>
                            <label className="label">Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                    )}

                    {error && <div className="toast toast-error">{error}</div>}
                    {success && <div className="toast toast-success">{success}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                        style={{ padding: '0.875rem' }}
                    >
                        {loading ? 'Loading...' : modeLabels[mode]}
                    </button>

                    {/* Secondary links */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        {mode === 'signin' && (
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: '0.8rem', textTransform: 'none' }}
                                onClick={() => switchMode('forgot')}
                            >
                                Forgot your password?
                            </button>
                        )}
                        {mode === 'forgot' && (
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: '0.8rem', textTransform: 'none' }}
                                onClick={() => switchMode('signin')}
                            >
                                Back to Sign In
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Decorative cards */}
            <div className="mt-12 flex gap-4" style={{ opacity: 0.35 }}>
                <span className="text-4xl">🂡</span>
                <span className="text-4xl">🂱</span>
                <span className="text-4xl" style={{ color: 'var(--accent-red)' }}>🂺</span>
                <span className="text-4xl">🃁</span>
                <span className="text-4xl" style={{ color: 'var(--accent-red)' }}>🃊</span>
            </div>
        </main>
    );
}
