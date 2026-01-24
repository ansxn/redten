'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useParams } from 'next/navigation';
import { Round, generateId, NewRoundData } from '@/types';
import { calculateRoundScores, applyRoundScores, formatPoints, formatMoney } from '@/lib/scoring';
import { calculateOptimalPayouts, getFinalStandings } from '@/lib/payout';
import * as db from '@/lib/database';
import Link from 'next/link';

type GamePhase = 'lobby' | 'round' | 'results' | 'payout';

export default function SessionPage() {
    const params = useParams();
    const router = useRouter();
    const { sessions, updateSession, endSession, user, updateStats, userStats, isGuestMode, loadSession } = useApp();

    const sessionId = params.id as string;
    const [session, setSession] = useState(sessions.find(s => s.id === sessionId));
    const [isLoading, setIsLoading] = useState(true);

    const [phase, setPhase] = useState<GamePhase>('lobby');
    const [multiplier, setMultiplier] = useState<1 | 2 | 4>(1);
    const [selectedRedPlayers, setSelectedRedPlayers] = useState<string[]>([]);
    const [roundResult, setRoundResult] = useState<'red_win' | 'blue_win' | 'wash' | null>(null);
    const [lastRoundScores, setLastRoundScores] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load session from database
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const loadedSession = await loadSession(sessionId);
            if (loadedSession) {
                setSession(loadedSession);
                if (loadedSession.status === 'completed') {
                    setPhase('payout');
                }
            }
            setIsLoading(false);
        };
        load();
    }, [sessionId]);

    // Update local session when sessions change
    useEffect(() => {
        const updated = sessions.find(s => s.id === sessionId);
        if (updated) {
            setSession(updated);
        }
    }, [sessions, sessionId]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex-center">
                <div className="text-2xl text-glow" style={{ color: 'var(--accent-gold)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex-center flex-col gap-4">
                <div className="text-2xl">Session not found</div>
                <Link href="/dashboard" className="btn btn-secondary">Go to Dashboard</Link>
            </div>
        );
    }

    const toggleRedPlayer = (playerId: string) => {
        if (selectedRedPlayers.includes(playerId)) {
            setSelectedRedPlayers(selectedRedPlayers.filter(id => id !== playerId));
        } else {
            setSelectedRedPlayers([...selectedRedPlayers, playerId]);
        }
    };

    const startNewRound = () => {
        setPhase('round');
        setMultiplier(1);
        setSelectedRedPlayers([]);
        setRoundResult(null);
    };

    const handleCall = () => {
        if (multiplier === 1) setMultiplier(2);
    };

    const handleDoubleCall = () => {
        if (multiplier === 2) setMultiplier(4);
    };

    const completeRound = async () => {
        if (!roundResult || selectedRedPlayers.length === 0) return;
        setIsSubmitting(true);

        const roundData: NewRoundData = {
            multiplier,
            red_team_player_ids: selectedRedPlayers,
            result: roundResult
        };

        try {
            // If authenticated, use cloud database
            if (!isGuestMode && user) {
                const result = await db.addRound(sessionId, roundData, session.players);
                if (result) {
                    const updatedSession = {
                        ...session,
                        players: result.updatedPlayers,
                        rounds: [...session.rounds, result.round]
                    };
                    updateSession(updatedSession);
                    setSession(updatedSession);
                    setLastRoundScores(result.round.points_awarded);
                    setPhase('results');

                    // Update user stats
                    const userScore = result.round.points_awarded[user.id];
                    if (userScore !== undefined) {
                        updateStats({
                            total_rounds_played: (userStats?.total_rounds_played || 0) + 1,
                            rounds_won: (userStats?.rounds_won || 0) + (userScore > 0 ? 1 : 0)
                        });
                    }
                    return;
                }
            }

            // Fallback to local
            const scores = calculateRoundScores(roundData, session.players);
            const updatedPlayers = applyRoundScores(session.players, scores);

            const newRound: Round = {
                id: generateId(),
                round_number: session.rounds.length + 1,
                multiplier,
                red_team_player_ids: selectedRedPlayers,
                result: roundResult,
                points_awarded: scores,
                created_at: new Date().toISOString()
            };

            const updatedSession = {
                ...session,
                players: updatedPlayers,
                rounds: [...session.rounds, newRound]
            };

            updateSession(updatedSession);
            setSession(updatedSession);
            setLastRoundScores(scores);
            setPhase('results');

            // Update user stats if they participated
            if (user && scores[user.id] !== undefined) {
                const won = scores[user.id] > 0;
                updateStats({
                    total_rounds_played: (userStats?.total_rounds_played || 0) + 1,
                    rounds_won: (userStats?.rounds_won || 0) + (won ? 1 : 0)
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEndSession = async () => {
        // Update stats for lifetime earnings
        if (user) {
            const userPlayer = session.players.find(p =>
                p.user_id === user.id || p.username === user.username
            );
            if (userPlayer) {
                const earnings = userPlayer.session_score * session.point_value;
                updateStats({
                    sessions_played: (userStats?.sessions_played || 0) + 1,
                    lifetime_earnings: (userStats?.lifetime_earnings || 0) + earnings,
                    best_session: Math.max(userStats?.best_session || 0, earnings),
                    worst_session: Math.min(userStats?.worst_session || 0, earnings)
                });
            }
        }

        endSession(sessionId);
        setPhase('payout');
    };

    const payoutTransactions = session.status === 'completed' || phase === 'payout'
        ? calculateOptimalPayouts(session.players, session.point_value)
        : [];

    const standings = getFinalStandings(session.players, session.point_value);

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <Link href="/dashboard" className="text-sm mb-2 inline-block" style={{ color: 'var(--text-muted)' }}>
                            ← Back to Dashboard
                        </Link>
                        <h1 className="text-title text-2xl md:text-3xl">
                            {session.name || 'Game Session'}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Round {session.rounds.length + (phase === 'round' ? 1 : 0)} •
                            ${session.point_value}/point
                        </p>
                    </div>

                    {session.status === 'active' && phase !== 'payout' && (
                        <button
                            onClick={handleEndSession}
                            className="btn btn-secondary"
                        >
                            End Session
                        </button>
                    )}
                </header>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="md:col-span-2">
                        {/* Lobby Phase */}
                        {phase === 'lobby' && session.status === 'active' && (
                            <div className="panel animate-slide-up">
                                <div className="panel-header">Ready to Play</div>

                                <div className="grid-players mb-6">
                                    {session.players.map(player => (
                                        <div key={player.user_id} className="player-card">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="player-avatar"
                                                    style={{ background: player.avatar_color }}
                                                >
                                                    {player.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold">{player.username}</div>
                                                    <div className={`player-score ${player.session_score > 0 ? 'positive' :
                                                            player.session_score < 0 ? 'negative' : 'neutral'
                                                        }`}>
                                                        {formatPoints(player.session_score)} pts
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={startNewRound}
                                    className="btn btn-primary w-full text-xl py-4"
                                >
                                    Start Round {session.rounds.length + 1}
                                </button>
                            </div>
                        )}

                        {/* Round Phase */}
                        {phase === 'round' && (
                            <div className="panel animate-slide-up">
                                <div className="panel-header">
                                    Round {session.rounds.length + 1} • {session.players.length} pts at stake
                                </div>

                                {/* Multiplier Controls */}
                                <div className="flex gap-md mb-6">
                                    <button
                                        onClick={handleCall}
                                        disabled={multiplier >= 2}
                                        className={`btn flex-1 ${multiplier >= 2 ? 'btn-secondary opacity-50' : 'btn-call'}`}
                                    >
                                        {multiplier >= 2 ? '✓ Called' : 'Call (2×)'}
                                    </button>
                                    <button
                                        onClick={handleDoubleCall}
                                        disabled={multiplier !== 2}
                                        className={`btn flex-1 ${multiplier === 4 ? 'btn-double' : multiplier === 2 ? 'btn-double' : 'btn-secondary opacity-50'}`}
                                    >
                                        {multiplier === 4 ? '✓ Double Called' : 'Double Call (4×)'}
                                    </button>
                                </div>

                                {/* Current Multiplier Display */}
                                {multiplier > 1 && (
                                    <div className="text-center mb-6">
                                        <span className={`multiplier-badge ${multiplier === 2 ? 'x2' : 'x4'}`}>
                                            {multiplier}× MULTIPLIER
                                        </span>
                                        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
                                            {session.players.length * multiplier} points at stake
                                        </p>
                                    </div>
                                )}

                                {/* Red Team Selection */}
                                <div className="mb-6">
                                    <h3 className="font-bold mb-3" style={{ color: 'var(--accent-red)' }}>
                                        🔴 Select Red 10 Holders
                                    </h3>
                                    <div className="grid-players">
                                        {session.players.map(player => (
                                            <div
                                                key={player.user_id}
                                                onClick={() => toggleRedPlayer(player.user_id)}
                                                className={`player-card ${selectedRedPlayers.includes(player.user_id) ? 'red-team' : ''
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="player-avatar"
                                                        style={{
                                                            background: selectedRedPlayers.includes(player.user_id)
                                                                ? 'var(--accent-red)'
                                                                : player.avatar_color
                                                        }}
                                                    >
                                                        {selectedRedPlayers.includes(player.user_id) ? '🔴' : player.username.charAt(0)}
                                                    </div>
                                                    <span className="font-bold">{player.username}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Result Selection */}
                                {selectedRedPlayers.length > 0 && (
                                    <div className="mb-6 animate-fade-in">
                                        <h3 className="font-bold mb-3">Result</h3>
                                        <div className="flex gap-md flex-wrap">
                                            <button
                                                onClick={() => setRoundResult('red_win')}
                                                className={`btn flex-1 ${roundResult === 'red_win' ? 'btn-primary' : 'btn-secondary'}`}
                                            >
                                                🔴 Red Wins
                                            </button>
                                            <button
                                                onClick={() => setRoundResult('blue_win')}
                                                className={`btn flex-1 ${roundResult === 'blue_win' ? 'btn-call' : 'btn-secondary'}`}
                                            >
                                                🔵 Blue Wins
                                            </button>
                                            <button
                                                onClick={() => setRoundResult('wash')}
                                                className={`btn flex-1 ${roundResult === 'wash' ? 'btn-gold' : 'btn-secondary'}`}
                                            >
                                                🟡 Wash
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Complete Round Button */}
                                <button
                                    onClick={completeRound}
                                    disabled={!roundResult || selectedRedPlayers.length === 0 || isSubmitting}
                                    className="btn btn-green w-full text-xl py-4"
                                >
                                    {isSubmitting ? 'Saving...' : 'Complete Round'}
                                </button>
                            </div>
                        )}

                        {/* Results Phase */}
                        {phase === 'results' && (
                            <div className="panel animate-slide-up">
                                <div className="panel-header">Round Complete!</div>

                                <div className="grid-players mb-6">
                                    {session.players.map(player => {
                                        const score = lastRoundScores[player.user_id] || 0;
                                        return (
                                            <div
                                                key={player.user_id}
                                                className={`player-card ${score > 0 ? 'red-team' : score < 0 ? 'blue-team' : ''}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="player-avatar" style={{ background: player.avatar_color }}>
                                                            {player.username.charAt(0)}
                                                        </div>
                                                        <span className="font-bold">{player.username}</span>
                                                    </div>
                                                    <div className={`player-score animate-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
                                                        }`}>
                                                        {formatPoints(score)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setPhase('lobby')}
                                    className="btn btn-primary w-full text-xl py-4"
                                >
                                    Continue
                                </button>
                            </div>
                        )}

                        {/* Payout Phase */}
                        {(phase === 'payout' || session.status === 'completed') && (
                            <div className="panel animate-slide-up">
                                <div className="panel-header">💰 Final Payout</div>

                                {/* Standings */}
                                <div className="mb-6">
                                    <h3 className="font-bold mb-3">Final Standings</h3>
                                    {standings.map((item, index) => (
                                        <div key={item.player.user_id} className="round-item mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold" style={{ color: 'var(--accent-gold)' }}>
                                                    #{index + 1}
                                                </span>
                                                <span>{item.player.username}</span>
                                            </div>
                                            <span className={`font-bold ${item.dollarAmount > 0 ? 'text-green-400' :
                                                    item.dollarAmount < 0 ? 'text-red-400' : ''
                                                }`}>
                                                {formatMoney(item.dollarAmount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Transactions */}
                                {payoutTransactions.length > 0 && (
                                    <div>
                                        <h3 className="font-bold mb-3">Optimal Payments ({payoutTransactions.length} transactions)</h3>
                                        {payoutTransactions.map((tx, index) => (
                                            <div key={index} className="payout-arrow mb-3">
                                                <div className="flex-1">
                                                    <span className="font-bold">{tx.from_player.username}</span>
                                                </div>
                                                <span className="arrow">→</span>
                                                <div className="payout-amount">{formatMoney(tx.amount)}</div>
                                                <span className="arrow">→</span>
                                                <div className="flex-1 text-right">
                                                    <span className="font-bold">{tx.to_player.username}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {payoutTransactions.length === 0 && (
                                    <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                        Everyone broke even! No payments needed.
                                    </div>
                                )}

                                <Link href="/dashboard" className="btn btn-gold w-full text-xl py-4 mt-6 block text-center">
                                    Back to Dashboard
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Sidebar - Round History */}
                    <div className="md:col-span-1">
                        <div className="panel">
                            <div className="panel-header">Round History</div>

                            {session.rounds.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)' }}>No rounds played yet</p>
                            ) : (
                                <div className="flex flex-col gap-sm max-h-96 overflow-y-auto">
                                    {[...session.rounds].reverse().map(round => (
                                        <div
                                            key={round.id}
                                            className={`round-item ${round.result === 'red_win' ? 'red-win' :
                                                    round.result === 'blue_win' ? 'blue-win' : 'wash'
                                                }`}
                                        >
                                            <div>
                                                <span className="font-bold">Round {round.round_number}</span>
                                                {round.multiplier > 1 && (
                                                    <span
                                                        className="ml-2 text-xs px-2 py-1 rounded"
                                                        style={{
                                                            background: round.multiplier === 2
                                                                ? 'var(--accent-blue)'
                                                                : 'var(--accent-purple)',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        {round.multiplier}×
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {round.result === 'red_win' ? '🔴 Red' :
                                                    round.result === 'blue_win' ? '🔵 Blue' : '🟡 Wash'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Current Scores */}
                        <div className="panel mt-4">
                            <div className="panel-header">Scores</div>
                            <div className="flex flex-col gap-sm">
                                {[...session.players]
                                    .sort((a, b) => b.session_score - a.session_score)
                                    .map(player => (
                                        <div key={player.user_id} className="flex justify-between items-center">
                                            <span>{player.username}</span>
                                            <span className={`font-bold font-mono ${player.session_score > 0 ? 'text-green-400' :
                                                    player.session_score < 0 ? 'text-red-400' : ''
                                                }`}>
                                                {formatPoints(player.session_score)}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
