'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

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
  if (!isLoading && user) {
    router.push('/dashboard');
    return null;
  }

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
    } catch (e) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      {/* Logo/Title */}
      <div className="text-center mb-8 md:mb-12 animate-slide-up">
        <img
          src="/redtenlogo1.png"
          alt="Red 10"
          className="h-14 md:h-20 mx-auto mb-2 md:mb-4"
        />
        <p className="text-base md:text-xl" style={{ color: 'var(--text-secondary)' }}>
          Tracker for TAW&apos;s favourite card game
        </p>
      </div>

      {/* Auth Panel */}
      <div className="panel w-full max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
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

          {error && (
            <div
              className="text-center py-2 px-4 rounded-lg"
              style={{
                background: 'rgba(231, 76, 76, 0.2)',
                color: 'var(--accent-red)'
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="text-center py-2 px-4 rounded-lg"
              style={{
                background: 'rgba(74, 222, 128, 0.2)',
                color: 'var(--accent-green)'
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading
              ? 'Loading...'
              : mode === 'signup'
                ? 'Create Account'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Send Reset Email'}
          </button>

          {/* Mode switching buttons */}
          <div className="flex flex-col gap-1">
            {mode === 'signup' && (
              <button
                type="button"
                className="text-center"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.9rem'
                }}
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setSuccess('');
                }}
              >
                Already have an account? Sign in
              </button>
            )}

            {mode === 'signin' && (
              <>
                <button
                  type="button"
                  className="text-center"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setSuccess('');
                  }}
                >
                  Don&apos;t have an account? Create one
                </button>
                <button
                  type="button"
                  className="text-center mt-1"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-gold)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.85rem'
                  }}
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setSuccess('');
                  }}
                >
                  Forgot your password?
                </button>
              </>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                className="text-center"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.9rem'
                }}
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setSuccess('');
                }}
              >
                Back to Sign In
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Decorative cards */}
      <div className="mt-12 flex gap-4 opacity-50">
        <span className="text-4xl">🂡</span>
        <span className="text-4xl">🂱</span>
        <span className="text-4xl" style={{ color: 'var(--accent-red)' }}>🂺</span>
        <span className="text-4xl">🃁</span>
        <span className="text-4xl" style={{ color: 'var(--accent-red)' }}>🃊</span>
      </div>
    </main>
  );
}
