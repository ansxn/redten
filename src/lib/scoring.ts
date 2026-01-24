/**
 * Scoring Logic for Red 10
 * 
 * Rules based on FINISHING ORDER:
 * - 6 players total, teams vary by who holds Red 10s
 * - Points calculated by how many consecutive positions the winning team holds
 * 
 * 3 vs 3 scenarios:
 * - 1 point: Winner gets 1st place only
 * - 2 points: Winner gets 1st AND 2nd place
 * - 2 points: Loser gets 6th AND 5th (last two)
 * - 3 points: Winner gets 1st, 2nd, AND 3rd
 * 
 * 4 vs 2:
 * - 4 points: Winner gets 1st, 2nd, 3rd, AND 4th
 * 
 * 5 vs 1:
 * - 5 points: Winner gets 1st, 2nd, 3rd, 4th, AND 5th
 * 
 * Multipliers:
 * - Normal: 1x
 * - Call: 2x
 * - Double Call: 4x
 * 
 * Wash: No points change (tie)
 */

import { SessionPlayer, NewRoundData } from '@/types';

export interface FinishOrderRoundData {
    multiplier: 1 | 2 | 4;
    red_team_player_ids: string[];
    finish_order: string[];  // Player IDs in order from 1st to 6th
    result: 'red_win' | 'blue_win' | 'wash';
}

/**
 * Calculate points based on finish order
 * Points = how many consecutive top positions the winning team holds
 */
export function calculatePointsFromFinishOrder(
    finishOrder: string[],
    winningTeamIds: string[]
): number {
    let points = 0;

    // Count consecutive wins from the front (1st, 2nd, 3rd...)
    for (let i = 0; i < finishOrder.length; i++) {
        if (winningTeamIds.includes(finishOrder[i])) {
            points++;
        } else {
            break;  // Stop at first non-winner
        }
    }

    // Also check consecutive losses from the back (6th, 5th, 4th...)
    let backPoints = 0;
    for (let i = finishOrder.length - 1; i >= 0; i--) {
        if (!winningTeamIds.includes(finishOrder[i])) {
            backPoints++;
        } else {
            break;
        }
    }

    // Take the higher of the two (front-loaded wins OR back-loaded losses)
    return Math.max(points, backPoints);
}

/**
 * Calculate the points each player wins or loses in a round
 * @param roundData - The round configuration with finish order
 * @param players - All players in the session
 * @returns Record of player_id -> points (positive = won, negative = lost)
 */
export function calculateRoundScores(
    roundData: NewRoundData | FinishOrderRoundData,
    players: SessionPlayer[]
): Record<string, number> {
    const { multiplier, red_team_player_ids, result } = roundData;

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
        return scores;
    }

    // Check if we have finish order data
    let basePoints = 1;
    if ('finish_order' in roundData && roundData.finish_order && roundData.finish_order.length > 0) {
        const winningTeamIds = winners.map(w => w.user_id);
        basePoints = calculatePointsFromFinishOrder(roundData.finish_order, winningTeamIds);
    }

    // Apply multiplier
    const pointsPerLoser = basePoints * multiplier;

    // Total points lost = pointsPerLoser * number of losers
    // Total points won = same amount, split among winners
    const totalLost = pointsPerLoser * losers.length;
    const winningsPerWinner = totalLost / winners.length;

    losers.forEach(player => {
        scores[player.user_id] = -pointsPerLoser;
    });

    winners.forEach(player => {
        scores[player.user_id] = winningsPerWinner;
    });

    return scores;
}

/**
 * Apply round scores to update session player totals
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
 * Get the total points at stake for a round (before knowing finish order)
 */
export function getPointsAtStake(multiplier: 1 | 2 | 4, playerCount: number): number {
    // Max possible is if one team sweeps all positions
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
