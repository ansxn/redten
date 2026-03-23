'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase';
import { User, Session, UserStats, generateId } from '@/types';
import * as db from '@/lib/database';

interface AppContextType {
    // Auth
    user: User | null;
    isLoading: boolean;
    isGuestMode: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    continueAsGuest: (username: string) => void;
    resetPassword: (email: string) => Promise<{ error: string | null }>;

    // Sessions
    sessions: Session[];
    activeSession: Session | null;
    createSession: (session: Session) => void;
    updateSession: (session: Session) => void;
    setActiveSession: (session: Session | null) => void;
    endSession: (sessionId: string) => Promise<void>;
    loadSessions: () => Promise<void>;
    loadSession: (sessionId: string) => Promise<Session | null>;

    // Stats
    userStats: UserStats | null;
    updateStats: (stats: Partial<UserStats>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SESSIONS_STORAGE_KEY = 'redten_sessions';
const STATS_STORAGE_KEY = 'redten_stats';
const USER_STORAGE_KEY = 'redten_user';

export function AppProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [userStats, setUserStats] = useState<UserStats | null>(null);

    const supabase = createClient();

    // Load sessions - from Supabase if authenticated, localStorage otherwise
    const loadSessions = async () => {
        if (user && supabase && !isGuestMode) {
            const cloudSessions = await db.getUserSessions(user.id);

            // Merge with existing sessions to preserve loaded rounds
            // CRITICAL: getUserSessions only fetches round IDs, not full round data
            // We must preserve existing complete rounds when cloudSession has incomplete data
            setSessions(prev => {
                return cloudSessions.map(cloudSession => {
                    const existing = prev.find(p => p.id === cloudSession.id);
                    if (!existing) return cloudSession;

                    // Check if existing has complete rounds (with result field)
                    const existingHasCompleteRounds = existing.rounds.length > 0 &&
                        existing.rounds[0]?.result !== undefined;

                    // Check if cloud session has incomplete rounds (only IDs, no result)
                    // getUserSessions returns rounds with only { id } shape
                    const cloudHasIncompleteRounds = cloudSession.rounds.length > 0 &&
                        cloudSession.rounds[0]?.result === undefined;

                    // Preserve existing complete rounds if cloud has incomplete data
                    if (existingHasCompleteRounds && cloudHasIncompleteRounds) {
                        return {
                            ...cloudSession,
                            rounds: existing.rounds,
                            // Also preserve player scores from existing if we have more complete data
                            players: existing.players.length > 0 ? existing.players : cloudSession.players
                        };
                    }

                    // Also preserve if cloud has no rounds but existing does
                    if (existing.rounds.length > 0 && cloudSession.rounds.length === 0) {
                        return { ...cloudSession, rounds: existing.rounds };
                    }

                    return cloudSession;
                });
            });
        } else if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
            if (stored) {
                try {
                    setSessions(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse sessions:', e);
                }
            }
        }
    };

    // Load a single session with full data
    const loadSession = async (sessionId: string): Promise<Session | null> => {
        if (supabase && !isGuestMode) {
            const session = await db.getSession(sessionId);
            if (session) {
                // Update local cache
                setSessions(prev => {
                    const existing = prev.findIndex(s => s.id === sessionId);
                    if (existing >= 0) {
                        const updated = [...prev];
                        updated[existing] = session;
                        return updated;
                    }
                    return prev;
                });
                return session;
            }
        }
        // Fallback to local
        return sessions.find(s => s.id === sessionId) || null;
    };

    // Save sessions to localStorage (for guest mode)
    useEffect(() => {
        if (typeof window !== 'undefined' && isGuestMode && sessions.length > 0) {
            localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
        }
    }, [sessions, isGuestMode]);

    // Load user stats
    useEffect(() => {
        const loadStats = async () => {
            if (!user) return;

            if (supabase && !isGuestMode) {
                // Use getOrCreateUserStats to ensure stats row exists
                const cloudStats = await db.getOrCreateUserStats(user.id);
                setUserStats(cloudStats);
                return;
            }

            // Fallback to localStorage for guest mode
            if (typeof window !== 'undefined') {
                const stored = localStorage.getItem(`${STATS_STORAGE_KEY}_${user.id}`);
                if (stored) {
                    try {
                        setUserStats(JSON.parse(stored));
                    } catch (e) {
                        console.error('Failed to parse stats:', e);
                    }
                } else {
                    const defaultStats: UserStats = {
                        user_id: user.id,
                        total_rounds_played: 0,
                        rounds_won: 0,
                        lifetime_earnings: 0,
                        sessions_played: 0,
                        best_session: 0,
                        worst_session: 0,
                    };
                    setUserStats(defaultStats);
                }
            }
        };

        loadStats();
    }, [user, isGuestMode]);

    // Save stats - ONLY for guest mode (cloud stats are managed by database triggers)
    useEffect(() => {
        if (!userStats || !user) return;

        // Only save to localStorage for guest mode
        // Cloud stats are now managed by database triggers, do NOT write from client
        if (isGuestMode && typeof window !== 'undefined') {
            localStorage.setItem(`${STATS_STORAGE_KEY}_${user.id}`, JSON.stringify(userStats));
        }
    }, [userStats, user, isGuestMode]);

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                // First check localStorage for guest user
                if (typeof window !== 'undefined') {
                    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
                    if (storedUser) {
                        try {
                            const parsedUser = JSON.parse(storedUser);
                            setUser(parsedUser);
                            setIsGuestMode(true);
                            setIsLoading(false);
                            return;
                        } catch (e) {
                            console.error('Failed to parse stored user:', e);
                        }
                    }
                }

                // Then check Supabase if configured
                if (supabase) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        setUser({
                            id: session.user.id,
                            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Player',
                            email: session.user.email,
                            created_at: session.user.created_at,
                        });
                        setIsGuestMode(false);
                    }
                }
            } catch (error) {
                console.error('Session check error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();

        // Listen for auth changes if Supabase is configured
        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    if (session?.user) {
                        setUser({
                            id: session.user.id,
                            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Player',
                            email: session.user.email,
                            created_at: session.user.created_at,
                        });
                        setIsGuestMode(false);
                    } else if (!isGuestMode) {
                        setUser(null);
                    }
                    setIsLoading(false);
                }
            );

            return () => subscription.unsubscribe();
        }
    }, []);

    // Load sessions when user changes
    useEffect(() => {
        if (user) {
            loadSessions();
        }
    }, [user, isGuestMode]);

    const signIn = async (email: string, password: string) => {
        if (!supabase) {
            return { error: 'Supabase is not configured. Use "Continue as Guest" instead.' };
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return { error: error.message };
            return { error: null };
        } catch (e) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signUp = async (email: string, password: string, username: string) => {
        if (!supabase) {
            return { error: 'Supabase is not configured. Use "Continue as Guest" instead.' };
        }

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username },
                    emailRedirectTo: `${window.location.origin}/auth/callback`
                }
            });
            if (error) return { error: error.message };
            return { error: null };
        } catch (e) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const continueAsGuest = (username: string) => {
        const guestUser: User = {
            id: generateId(),
            username: username || 'Guest',
            created_at: new Date().toISOString(),
        };

        setUser(guestUser);
        setIsGuestMode(true);

        if (typeof window !== 'undefined') {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestUser));
        }
    };

    const resetPassword = async (email: string) => {
        if (!supabase) {
            return { error: 'Supabase is not configured.' };
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?type=recovery`
            });
            if (error) return { error: error.message };
            return { error: null };
        } catch (e) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signOut = async () => {
        if (supabase && !isGuestMode) {
            await supabase.auth.signOut();
        }

        setUser(null);
        setIsGuestMode(false);
        setActiveSession(null);
        setSessions([]);

        if (typeof window !== 'undefined') {
            localStorage.removeItem(USER_STORAGE_KEY);
        }
    };

    const createSession = (session: Session) => {
        setSessions(prev => [...prev, session]);
    };

    const updateSession = (session: Session) => {
        setSessions(prev => prev.map(s => s.id === session.id ? session : s));
        if (activeSession?.id === session.id) {
            setActiveSession(session);
        }
    };

    const endSessionHandler = async (sessionId: string) => {
        // Update in cloud if not guest
        if (supabase && !isGuestMode) {
            const success = await db.endSession(sessionId);

            if (!success) {
                alert('Failed to end session. You may not have permission — only the session creator or a participant can end it.');
                return;
            }

            // Reload stats to get the server-calculated updates
            if (user) {
                const cloudStats = await db.getUserStats(user.id);
                if (cloudStats) {
                    setUserStats(cloudStats);
                }
            }
        }

        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, status: 'completed' as const } : s
        ));
        if (activeSession?.id === sessionId) {
            setActiveSession(null);
        }
    };

    const updateStats = (updates: Partial<UserStats>) => {
        setUserStats(prev => prev ? { ...prev, ...updates } : null);
    };

    return (
        <AppContext.Provider value={{
            user,
            isLoading,
            isGuestMode,
            signIn,
            signUp,
            signOut,
            continueAsGuest,
            resetPassword,
            sessions,
            activeSession,
            createSession,
            updateSession,
            setActiveSession,
            endSession: endSessionHandler,
            loadSessions,
            loadSession,
            userStats,
            updateStats,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
