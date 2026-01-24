/**
 * Scoring Logic for Red 10
 * 
 * Rules:
 * - Each round has a base buy-in of 1 point per player
 * - "Called" doubles the stakes (2x)
 * - "Double Called" quadruples the stakes (4x)
 * - Red team: players holding Red 10s
 * - Blue team: players not holding Red 10s
 * - Red wins: someone on red team finishes first AND entire red team finishes before blue team
 * - Blue wins: blue team finishes first OR finishes before red team even if red had first out
 * - Wash: tie, all points return
 */

import { Round, SessionPlayer, NewRoundData } from '@/types';

/**
 * Calculate the points each player wins or loses in a round
 * @param roundData - The round configuration
 * @param players - All players in the session
 * @returns Record of player_id -> points (positive = won, negative = lost)
 */
export function calculateRoundScores(
    roundData: NewRoundData,
    players: SessionPlayer[]
): Record<string, number> {
    const { multiplier, red_team_player_ids, result } = roundData;

    // Base buy-in is 1 point per person
    const basePoints = 1;
    const totalPoints = basePoints * multiplier;

    // Initialize all scores to 0
    const scores: Record<string, number> = {};
    players.forEach(p => {
        scores[p.user_id] = 0;
    });

    // If wash, no points change
    if (result === 'wash') {
        return scores;
    }

    // Divide players into teams
    const redTeam = players.filter(p => red_team_player_ids.includes(p.user_id));
    const blueTeam = players.filter(p => !red_team_player_ids.includes(p.user_id));

    // Determine winners and losers
    const winners = result === 'red_win' ? redTeam : blueTeam;
    const losers = result === 'red_win' ? blueTeam : redTeam;

    if (losers.length === 0 || winners.length === 0) {
        // Edge case: everyone on same team (shouldn't happen but handle gracefully)
        return scores;
    }

    // Each loser loses totalPoints
    // Each winner gains (total lost by losers) / (number of winners)
    const totalLost = totalPoints * losers.length;
    const winningsPerWinner = totalLost / winners.length;

    losers.forEach(player => {
        scores[player.user_id] = -totalPoints;
    });

    winners.forEach(player => {
        scores[player.user_id] = winningsPerWinner;
    });

    return scores;
}

/**
 * Apply round scores to update session player totals
 * @param players - Current session players
 * @param roundScores - Points from the round
 * @returns Updated players with new session_score
 */
export function applyRoundScores(
    players: SessionPlayer[],
    roundScores: Record<string, number>
): SessionPlayer[] {
    return players.map(player => ({
        ...player,
        session_score: player.session_score + (roundScores[player.user_id] || 0)
    }));
}

/**
 * Get the total points at stake for a round
 */
export function getPointsAtStake(multiplier: 1 | 2 | 4, playerCount: number): number {
    return multiplier * playerCount;
}

/**
 * Format points for display
 */
export function formatPoints(points: number): string {
    if (points > 0) return `+${points.toFixed(1)}`;
    if (points < 0) return points.toFixed(1);
    return '0';
}

/**
 * Format money for display
 */
export function formatMoney(amount: number): string {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
    });
    return amount < 0 ? `-${formatted}` : formatted;
}
