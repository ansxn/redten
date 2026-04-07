'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useParams } from 'next/navigation';
import { Round, generateId, NewRoundData } from '@/types';
import { calculateRoundScores, applyRoundScores, formatPoints, formatMoney, calculatePointsPreview } from '@/lib/scoring';
import { calculateOptimalPayouts, getFinalStandings } from '@/lib/payout';
import * as db from '@/lib/database';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import LoadingScreen from '@/components/LoadingScreen';

type GamePhase = 'lobby' | 'teams' | 'finish_order' | 'results' | 'payout';

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
    const [finishOrder, setFinishOrder] = useState<string[]>([]);
    const [lastRoundScores, setLastRoundScores] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingRoundId, setEditingRoundId] = useState<string | null>(null);

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

    // Update local session when sessions change (with safeguard)
    useEffect(() => {
        const updated = sessions.find(s => s.id === sessionId);
        if (updated) {
            const currentHasCompleteRounds = session?.rounds && session.rounds.length > 0 &&
                session.rounds[0]?.result !== undefined;
            const updatedHasIncompleteRounds = updated.rounds.length > 0 &&
                updated.rounds[0]?.result === undefined;

            if (currentHasCompleteRounds && updatedHasIncompleteRounds) {
                setSession(prev => prev ? {
                    ...updated,
                    rounds: prev.rounds,
                    players: prev.players
                } : updated);
            } else {
                setSession(updated);
            }
        }
    }, [sessions, sessionId]);

    if (isLoading) return <LoadingScreen />;

    if (!session) {
        return (
            <div className="min-h-screen flex-center" style={{ flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <div style={{ fontSize: '1.5rem' }}>Session not found</div>
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
        setPhase('teams');
        setMultiplier(1);
        setSelectedRedPlayers([]);
        setFinishOrder([]);
    };

    const handleCall = () => {
        setMultiplier(current => current === 2 ? 1 : 2);
    };

    const handleDoubleCall = () => {
        setMultiplier(current => current === 4 ? 2 : 4);
    };

    const proceedToFinishOrder = () => {
        if (selectedRedPlayers.length === 0) return;
        setFinishOrder([]);
        setPhase('finish_order');
    };

    const addToFinishOrder = (playerId: string) => {
        if (finishOrder.includes(playerId)) return;
        setFinishOrder([...finishOrder, playerId]);
    };

    const removeFromFinishOrder = (playerId: string) => {
        setFinishOrder(finishOrder.filter(id => id !== playerId));
    };

    const getFinishPosition = (playerId: string): number | null => {
        const index = finishOrder.indexOf(playerId);
        return index >= 0 ? index + 1 : null;
    };

    const determineWinner = (): 'red_win' | 'blue_win' | null => {
        if (finishOrder.length !== 6) return null;
        const firstPlace = finishOrder[0];
        return selectedRedPlayers.includes(firstPlace) ? 'red_win' : 'blue_win';
    };

    const getPointsPreview = (): number => {
        if (finishOrder.length !== 6) return 0;
        const allPlayerIds = session.players.map(p => p.id);
        return calculatePointsPreview(finishOrder, selectedRedPlayers, allPlayerIds);
    };

    const completeRound = async () => {
        if (finishOrder.length !== 6) return;
        setIsSubmitting(true);

        const result = determineWinner();
        if (!result) {
            setIsSubmitting(false);
            return;
        }

        const roundData: NewRoundData = {
            multiplier,
            red_team_player_ids: selectedRedPlayers,
            finish_order: finishOrder,
            result
        };

        // HANDLE EDIT MODE
        if (editingRoundId) {
            if (!isGuestMode && user) {
                console.log('=== EDIT ROUND START ===');
                console.log('Session players BEFORE updateRound:', session.players.map(p => ({ id: p.id, user_id: p.user_id, score: p.session_score })));
                console.log('Round data:', roundData);

                const dbResult = await db.updateRound(sessionId, editingRoundId, roundData, session.players);

                console.log('updateRound returned:', dbResult);
                if (dbResult) {
                    console.log('Updated players from DB:', dbResult.updatedPlayers.map(p => ({ id: p.id, user_id: p.user_id, score: p.session_score })));
                }

                if (dbResult) {
                    const updatedRounds = session.rounds.map(r =>
                        r.id === editingRoundId
                            ? { ...r, ...roundData, round_number: r.round_number, id: r.id, created_at: r.created_at, points_awarded: calculateRoundScores(roundData, session.players) }
                            : r
                    );

                    const updatedSession = {
                        ...session,
                        players: dbResult.updatedPlayers,
                        rounds: updatedRounds
                    };

                    console.log('Setting updatedSession with players:', updatedSession.players.map(p => ({ id: p.id, score: p.session_score })));
                    updateSession(updatedSession);
                    setSession(updatedSession);
                    setEditingRoundId(null);
                    setPhase('lobby');
                    console.log('=== EDIT ROUND COMPLETE ===');
                }
            } else {
                const oldRound = session.rounds.find(r => r.id === editingRoundId);
                const oldScores = oldRound ? oldRound.points_awarded : {};
                const newScores = calculateRoundScores(roundData, session.players);

                const updatedPlayers = session.players.map(p => {
                    const oldPoints = oldScores[p.id] || 0;
                    const newPoints = newScores[p.id] || 0;
                    return { ...p, session_score: p.session_score - oldPoints + newPoints };
                });

                const updatedRounds = session.rounds.map(r =>
                    r.id === editingRoundId ? { ...r, ...roundData, points_awarded: newScores } : r
                );

                const updatedSession = { ...session, players: updatedPlayers, rounds: updatedRounds };
                updateSession(updatedSession);
                setSession(updatedSession);
                setEditingRoundId(null);
                setPhase('lobby');
            }

            setIsSubmitting(false);
            return;
        }

        // NORMAL NEW ROUND
        if (!isGuestMode && user) {
            const dbResult = await db.addRound(sessionId, roundData, session.players);
            if (dbResult) {
                const updatedSession = {
                    ...session,
                    players: dbResult.updatedPlayers,
                    rounds: [...session.rounds, dbResult.round]
                };
                updateSession(updatedSession);
                setSession(updatedSession);
                setLastRoundScores(dbResult.round.points_awarded);
                setPhase('results');

                const updatedStats = await db.getUserStats(user.id);
                if (updatedStats) {
                    updateStats(updatedStats);
                }
                setIsSubmitting(false);
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
            finish_order: finishOrder,
            result,
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

        if (user && scores[user.id] !== undefined) {
            const won = scores[user.id] > 0;
            updateStats({
                total_rounds_played: (userStats?.total_rounds_played || 0) + 1,
                rounds_won: (userStats?.rounds_won || 0) + (won ? 1 : 0)
            });
        }
        setIsSubmitting(false);
    };

    const handleWash = async () => {
        if (finishOrder.length !== 6) {
            alert('Please select all 6 player placements before recording the wash.');
            return;
        }

        const roundData: NewRoundData = {
            multiplier,
            red_team_player_ids: selectedRedPlayers,
            finish_order: finishOrder,
            result: 'wash'
        };

        if (editingRoundId) {
            if (!isGuestMode && user) {
                const dbResult = await db.updateRound(sessionId, editingRoundId, roundData, session.players);
                if (dbResult) {
                    const updatedRounds = session.rounds.map(r =>
                        r.id === editingRoundId
                            ? { ...r, ...roundData, round_number: r.round_number, id: r.id, created_at: r.created_at, points_awarded: {} }
                            : r
                    );
                    const updatedSession = { ...session, players: dbResult.updatedPlayers, rounds: updatedRounds };
                    updateSession(updatedSession);
                    setSession(updatedSession);
                    setEditingRoundId(null);
                    setPhase('lobby');
                }
            } else {
                const oldRound = session.rounds.find(r => r.id === editingRoundId);
                const oldScores = oldRound ? oldRound.points_awarded : {};
                const newScores: Record<string, number> = {};

                const updatedPlayers = session.players.map(p => {
                    const oldPoints = oldScores[p.id] || 0;
                    return { ...p, session_score: p.session_score - oldPoints };
                });

                const updatedRounds = session.rounds.map(r =>
                    r.id === editingRoundId ? { ...r, ...roundData, points_awarded: newScores } : r
                );

                const updatedSession = { ...session, players: updatedPlayers, rounds: updatedRounds };
                updateSession(updatedSession);
                setSession(updatedSession);
                setEditingRoundId(null);
                setPhase('lobby');
            }
            return;
        }

        if (!isGuestMode && user) {
            const dbResult = await db.addRound(sessionId, roundData, session.players);
            if (dbResult) {
                const updatedSession = {
                    ...session,
                    players: dbResult.updatedPlayers,
                    rounds: [...session.rounds, dbResult.round]
                };
                updateSession(updatedSession);
                setSession(updatedSession);
                setLastRoundScores({});
                setPhase('results');
                return;
            }
        }

        const newRound: Round = {
            id: generateId(),
            round_number: session.rounds.length + 1,
            multiplier,
            red_team_player_ids: selectedRedPlayers,
            finish_order: finishOrder,
            result: 'wash',
            points_awarded: {},
            created_at: new Date().toISOString()
        };

        const updatedSession = { ...session, rounds: [...session.rounds, newRound] };
        updateSession(updatedSession);
        setSession(updatedSession);
        setLastRoundScores({});
        setPhase('results');
    };

    const handleEditRound = (round: Round) => {
        setEditingRoundId(round.id);
        setMultiplier(round.multiplier);
        setSelectedRedPlayers(round.red_team_player_ids || []);
        setFinishOrder(round.finish_order || []);
        setPhase('teams');
    };

    const cancelEdit = () => {
        setEditingRoundId(null);
        setPhase('lobby');
    };

    const handleEndSession = async () => {
        if (!confirm('End this session? Final payouts will be calculated and the session will be marked complete.')) return;
        if (session.status !== 'completed') {
            await endSession(sessionId);
        }
        setPhase('payout');
    };

    const payoutTransactions = session.status === 'completed' || phase === 'payout'
        ? calculateOptimalPayouts(session.players, session.point_value)
        : [];

    const standings = getFinalStandings(session.players, session.point_value);

    const winner = determineWinner();
    const pointsPreview = getPointsPreview();

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="container">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div>
                        <Link href="/dashboard" className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', marginBottom: 'var(--space-sm)', display: 'inline-flex' }}>
                            ← Dashboard
                        </Link>
                        <h1 className="text-title" style={{ fontSize: '1.5rem' }}>
                            {session.name || 'Game Session'}
                        </h1>
                        <p className="text-sub" style={{ fontSize: '0.9rem' }}>
                            Round {session.rounds.length + (phase === 'teams' || phase === 'finish_order' ? 1 : 0)} • ${session.point_value}/point
                        </p>
                    </div>

                    {session.status === 'active' && phase !== 'payout' && (
                        <button onClick={handleEndSession} className="btn btn-secondary">
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

                                <div className="grid-players" style={{ marginBottom: 'var(--space-xl)' }}>
                                    {session.players.map(player => (
                                        <div key={player.id} className="player-card" style={{ cursor: 'default' }}>
                                            <div className="flex items-center gap-3">
                                                {player.is_guest ? (
                                                    <>
                                                        <Avatar
                                                            username={player.username}
                                                            avatarColor={player.avatar_color}
                                                            size="sm"
                                                        />
                                                        <div style={{ minWidth: 0 }}>
                                                            <div className="font-bold" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.username}</div>
                                                            <div className={`player-score ${player.session_score > 0 ? 'positive' : player.session_score < 0 ? 'negative' : 'neutral'}`} style={{ fontSize: '1rem' }}>
                                                                {formatPoints(player.session_score)} pts
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <Link href={`/profile/${player.user_id || ''}`} className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity" style={{ minWidth: 0 }}>
                                                        <Avatar
                                                            userId={player.user_id || undefined}
                                                            username={player.username}
                                                            avatarColor={player.avatar_color}
                                                            size="sm"
                                                        />
                                                        <div style={{ minWidth: 0 }}>
                                                            <div className="font-bold" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.username}</div>
                                                            <div className={`player-score ${player.session_score > 0 ? 'positive' : player.session_score < 0 ? 'negative' : 'neutral'}`} style={{ fontSize: '1rem' }}>
                                                                {formatPoints(player.session_score)} pts
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={startNewRound}
                                    className="btn btn-primary btn-cta-glow w-full text-xl py-4"
                                >
                                    Start Round {session.rounds.length + 1}
                                </button>
                            </div>
                        )}

                        {/* Teams Phase */}
                        {phase === 'teams' && (
                            <div className="panel animate-slide-up">
                                {/* Stepper */}
                                <div className="stepper">
                                    <div className="stepper-step">
                                        <div className="stepper-dot active" />
                                        <span className="stepper-label text-accent-gold">Teams</span>
                                    </div>
                                    <div className="stepper-line" style={{ background: 'var(--border-color)' }} />
                                    <div className="stepper-step">
                                        <div className="stepper-dot pending" />
                                        <span className="stepper-label text-dim">Placements</span>
                                    </div>
                                </div>

                                <div className="panel-header">
                                    {editingRoundId ? 'Edit Round — Select Red 10 Holders' : 'Select Red 10 Holders'}
                                </div>

                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <h3 className="font-bold" style={{ color: 'var(--accent-red)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
                                        🔴 Tap players holding Red 10s
                                    </h3>
                                    <div className="grid-players">
                                        {session.players.map(player => (
                                            <div
                                                key={player.id}
                                                onClick={() => toggleRedPlayer(player.id)}
                                                className={`player-card ${selectedRedPlayers.includes(player.id) ? 'red-team' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="player-avatar avatar-sm"
                                                        style={{
                                                            background: selectedRedPlayers.includes(player.id)
                                                                ? 'var(--accent-red)'
                                                                : player.avatar_color
                                                        }}
                                                    >
                                                        {selectedRedPlayers.includes(player.id) ? '🔴' : player.username.charAt(0)}
                                                    </div>
                                                    <span className="font-bold" style={{ fontSize: '0.85rem' }}>{player.username}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-sm flex-wrap">
                                    <button
                                        onClick={editingRoundId ? cancelEdit : () => setPhase('lobby')}
                                        className="btn btn-secondary flex-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={proceedToFinishOrder}
                                        disabled={selectedRedPlayers.length === 0}
                                        className="btn btn-primary flex-1"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Finish Order Phase */}
                        {phase === 'finish_order' && (
                            <div className="panel animate-slide-up">
                                {/* Stepper */}
                                <div className="stepper">
                                    <div className="stepper-step">
                                        <div className="stepper-dot complete" />
                                        <span className="stepper-label text-positive">Teams ✓</span>
                                    </div>
                                    <div className="stepper-line" style={{ background: 'var(--accent-gold)' }} />
                                    <div className="stepper-step">
                                        <div className="stepper-dot active" />
                                        <span className="stepper-label text-accent-gold">Placements</span>
                                    </div>
                                </div>

                                <div className="panel-header">
                                    Tap Players in Finish Order (1st → 6th)
                                </div>

                                {/* Call / Double Call Controls */}
                                <div className="flex gap-sm md:gap-md flex-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
                                    <button
                                        onClick={handleCall}
                                        className={`btn flex-1 ${multiplier >= 2 ? 'btn-call' : 'btn-secondary'}`}
                                    >
                                        {multiplier >= 2 ? '✓ Called' : 'Call (2×)'}
                                    </button>
                                    <button
                                        onClick={handleDoubleCall}
                                        disabled={multiplier === 1}
                                        className={`btn flex-1 ${multiplier === 4 ? 'btn-double' : multiplier === 1 ? 'btn-secondary opacity-50' : 'btn-secondary'}`}
                                    >
                                        {multiplier === 4 ? '✓ Double' : 'Double (4×)'}
                                    </button>
                                </div>

                                {/* Active Multiplier Badge */}
                                {multiplier > 1 && (
                                    <div className="text-center animate-fade-in" style={{ marginBottom: 'var(--space-lg)' }}>
                                        <span className={`multiplier-badge ${multiplier === 2 ? 'x2' : 'x4'}`}>
                                            {multiplier === 2 ? '2× CALL' : '4× DOUBLE CALL'}
                                        </span>
                                    </div>
                                )}

                                {/* Current Finish Order Display */}
                                <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                    <p className="text-dim" style={{ fontSize: '0.8rem', marginBottom: 'var(--space-sm)' }}>
                                        Finish Order ({finishOrder.length}/6):
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                        {finishOrder.map((playerId, index) => {
                                            const player = session.players.find(p => p.id === playerId);
                                            const isRed = selectedRedPlayers.includes(playerId);
                                            return (
                                                <button
                                                    key={playerId}
                                                    onClick={() => removeFromFinishOrder(playerId)}
                                                    className="btn btn-secondary"
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.2rem 0.5rem',
                                                        borderColor: isRed ? 'rgba(231, 76, 76, 0.5)' : 'rgba(96, 165, 250, 0.5)',
                                                    }}
                                                >
                                                    {index + 1}. {player?.username} ×
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Player Selection */}
                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <div className="grid-players">
                                        {session.players.map(player => {
                                            const position = getFinishPosition(player.id);
                                            const isRed = selectedRedPlayers.includes(player.id);
                                            const isSelected = position !== null;

                                            return (
                                                <div
                                                    key={player.id}
                                                    onClick={() => !isSelected && addToFinishOrder(player.id)}
                                                    className={`player-card ${isRed ? 'red-team' : 'blue-team'} ${isSelected ? 'opacity-50' : ''}`}
                                                    style={{ cursor: isSelected ? 'not-allowed' : 'pointer' }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="player-avatar avatar-sm"
                                                                style={{
                                                                    background: isRed ? 'var(--accent-red)' : 'var(--accent-blue)',
                                                                }}
                                                            >
                                                                {isRed ? '🔴' : '🔵'}
                                                            </div>
                                                            <span className="font-bold" style={{ fontSize: '0.85rem' }}>{player.username}</span>
                                                        </div>
                                                        {position !== null && (
                                                            <span className="font-bold font-data text-accent-gold" style={{ fontSize: '1.1rem' }}>
                                                                #{position}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Points Preview */}
                                {finishOrder.length === 6 && (
                                    <div className="animate-fade-in" style={{
                                        marginBottom: 'var(--space-lg)',
                                        padding: 'var(--space-lg)',
                                        borderRadius: 'var(--radius-md)',
                                        textAlign: 'center',
                                        background: winner === 'red_win' ? 'var(--accent-red-muted)' : 'var(--accent-blue-muted)',
                                    }}>
                                        <div style={{
                                            fontSize: '1.1rem',
                                            marginBottom: 'var(--space-xs)',
                                            color: winner === 'red_win' ? 'var(--accent-red)' : 'var(--accent-blue)',
                                        }}>
                                            {winner === 'red_win' ? '🔴 Red Wins!' : '🔵 Blue Wins!'}
                                        </div>
                                        <div className="font-bold font-data text-accent-gold" style={{ fontSize: '1.5rem' }}>
                                            {pointsPreview * multiplier} points × ${session.point_value}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-sm flex-wrap">
                                    <button onClick={() => setPhase('teams')} className="btn btn-secondary">
                                        ← Back
                                    </button>
                                    <button onClick={handleWash} className="btn btn-gold">
                                        🟡 Wash
                                    </button>
                                    <button
                                        onClick={completeRound}
                                        disabled={finishOrder.length !== 6 || isSubmitting}
                                        className="btn btn-green flex-1"
                                    >
                                        {isSubmitting ? 'Saving...' : editingRoundId ? 'Update Round' : 'Complete Round'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Results Phase */}
                        {phase === 'results' && (
                            <div className="panel animate-slide-up">
                                <div className="panel-header">Round Complete!</div>

                                <div className="grid-players" style={{ marginBottom: 'var(--space-xl)' }}>
                                    {session.players.map(player => {
                                        const score = lastRoundScores[player.id] || 0;
                                        return (
                                            <div
                                                key={player.id}
                                                className={`player-card ${score > 0 ? 'red-team' : score < 0 ? 'blue-team' : ''}`}
                                                style={{ cursor: 'default' }}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="player-avatar avatar-sm" style={{ background: player.avatar_color }}>
                                                            {player.username.charAt(0)}
                                                        </div>
                                                        <span className="font-bold" style={{ fontSize: '0.85rem' }}>{player.username}</span>
                                                    </div>
                                                    <div className={`player-score animate-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}`}>
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
                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <h3 className="font-bold" style={{ marginBottom: 'var(--space-md)' }}>Final Standings</h3>
                                    {standings.map((item, index) => (
                                        <div key={item.player.id} className="round-item" style={{ marginBottom: 'var(--space-sm)' }}>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold font-data text-accent-gold">
                                                    #{index + 1}
                                                </span>
                                                <span>{item.player.username}</span>
                                            </div>
                                            <span className={`font-bold font-data ${item.dollarAmount > 0 ? 'text-positive' : item.dollarAmount < 0 ? 'text-negative' : ''}`}>
                                                {formatMoney(item.dollarAmount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Transactions */}
                                {payoutTransactions.length > 0 && (
                                    <div>
                                        <h3 className="font-bold" style={{ marginBottom: 'var(--space-md)' }}>
                                            Optimal Payments ({payoutTransactions.length})
                                        </h3>
                                        {payoutTransactions.map((tx, index) => (
                                            <div key={index} className="payout-arrow" style={{ marginBottom: 'var(--space-md)' }}>
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
                                    <div className="text-center text-dim" style={{ padding: 'var(--space-xl)' }}>
                                        Everyone broke even! No payments needed.
                                    </div>
                                )}

                                <Link href="/dashboard" className="btn btn-gold w-full text-xl py-4 block text-center" style={{ marginTop: 'var(--space-xl)' }}>
                                    Back to Dashboard
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Sidebar — Round History */}
                    <div className="md:col-span-1">
                        <div className="panel">
                            <div className="panel-header">Round History</div>

                            {session.rounds.length === 0 ? (
                                <p className="text-dim">No rounds played yet</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxHeight: 384, overflowY: 'auto' }}>
                                    {[...session.rounds].reverse().map(round => (
                                        <div
                                            key={round.id}
                                            className={`round-item ${round.result === 'red_win' ? 'red-win' : round.result === 'blue_win' ? 'blue-win' : 'wash'}`}
                                            style={round.result === 'wash' ? { background: 'var(--accent-gold-muted)' } : undefined}
                                        >
                                            <div>
                                                <span className="font-bold">Round {round.round_number}</span>
                                                {round.multiplier > 1 && (
                                                    <span
                                                        style={{
                                                            marginLeft: 'var(--space-sm)',
                                                            fontSize: '0.65rem',
                                                            padding: '2px 6px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            background: round.multiplier === 2 ? 'var(--accent-blue)' : 'var(--accent-purple)',
                                                            color: 'white',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {round.multiplier}×
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-xs)' }}>
                                                <span className="text-dim" style={{ fontSize: '0.7rem' }}>
                                                    {round.result === 'red_win' ? '🔴 Red' : round.result === 'blue_win' ? '🔵 Blue' : '🟡 Wash'}
                                                </span>
                                                {!editingRoundId && session.status === 'active' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditRound(round);
                                                        }}
                                                        className="btn btn-ghost"
                                                        style={{ fontSize: '0.6rem', padding: '2px 6px' }}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Current Scores */}
                        <div className="panel" style={{ marginTop: 'var(--space-lg)' }}>
                            <div className="panel-header">Scores</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {(() => {
                                    const scoreMap = new Map<string, { username: string; score: number; user_id: string | null; is_guest: boolean }>();

                                    for (const player of session.players) {
                                        const key = player.user_id || player.id;
                                        if (!scoreMap.has(key)) {
                                            scoreMap.set(key, {
                                                username: player.username,
                                                score: 0,
                                                user_id: player.user_id,
                                                is_guest: player.is_guest
                                            });
                                        }
                                    }

                                    for (const round of session.rounds) {
                                        if (!round.points_awarded) continue;
                                        for (const [playerId, points] of Object.entries(round.points_awarded)) {
                                            const player = session.players.find(p => p.id === playerId);
                                            const key = player ? (player.user_id || player.id) : playerId;
                                            const entry = scoreMap.get(key);
                                            if (entry) {
                                                entry.score += points;
                                            }
                                        }
                                    }

                                    return [...scoreMap.values()]
                                        .sort((a, b) => b.score - a.score)
                                        .map(entry => (
                                            <div key={entry.user_id || entry.username} className="flex justify-between items-center">
                                                {entry.is_guest ? (
                                                    <span style={{ fontSize: '0.9rem' }}>{entry.username}</span>
                                                ) : (
                                                    <Link
                                                        href={`/profile/${entry.user_id || ''}`}
                                                        className="hover:underline decoration-dotted underline-offset-4"
                                                        style={{ fontSize: '0.9rem' }}
                                                    >
                                                        {entry.username}
                                                    </Link>
                                                )}
                                                <span className={`font-bold font-data ${entry.score > 0 ? 'text-positive' : entry.score < 0 ? 'text-negative' : ''}`}>
                                                    {formatPoints(entry.score)}
                                                </span>
                                            </div>
                                        ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
