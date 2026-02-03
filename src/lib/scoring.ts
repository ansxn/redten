/**
 * Scoring Logic for Red 10
 * 
 * Rules based on FINISHING ORDER (first out = winner):
 * 
 * Winning team = team with first person out
 * Wash = someone in the winning team gets out last (no points change)
 * 
 * 3 vs 3 scenarios:
 * - Points = number of losing team members left when last winning team member gets out
 * - Then apply multipliers (1x, 2x, 4x)
 * 
 * 2 Red Ten vs 4 Regulars:
 * - Red tens 1st & 2nd: winners gain 8, losers lose 4
 * - Red tens 1st & (3rd/4th/5th): winners gain 4, losers lose 2
 * - Regulars 1st/2nd/3rd/4th: regulars gain 4, red tens lose 8
 * - Regulars win any other way: regulars gain 2, red tens lose 4
 * 
 * 1 Red Ten vs 5 Regulars:
 * - Red ten 1st: red ten gains 25, everyone else loses 5
 * - Red ten last (6th): red ten loses 25, everyone else gains 5
 * 
 * Multipliers (only for 3v3):
 * - Normal: 1x
 * - Call: 2x
 * - Double Call: 4x
 */

import { SessionPlayer, NewRoundData } from '@/types';

export interface FinishOrderRoundData {
    multiplier: 1 | 2 | 4;
    red_team_player_ids: string[];
    finish_order: string[];  // Player IDs in order from 1st to 6th (1st = first out = winner)
    result: 'red_win' | 'blue_win' | 'wash';
}

/**
 * Determine if a round is a wash
 * Wash = winning team member (team of 1st place) gets out last
 */
export function isWash(finishOrder: string[], winningTeamIds: string[]): boolean {
    if (finishOrder.length === 0) return false;
    const lastPlayerId = finishOrder[finishOrder.length - 1];
    return winningTeamIds.includes(lastPlayerId);
}

/**
 * Calculate points for 3v3 scenario
 * Points = number of losing team members left when last winning team member gets out
 */
export function calculate3v3Points(
    finishOrder: string[],
    winningTeamIds: string[],
    losingTeamIds: string[]
): number {
    // Find when the last winning team member got out
    let lastWinnerPosition = -1;
    for (let i = 0; i < finishOrder.length; i++) {
        if (winningTeamIds.includes(finishOrder[i])) {
            lastWinnerPosition = i;
        }
    }

    if (lastWinnerPosition === -1) return 0;

    // Count how many losing team members haven't gotten out yet at that point
    const losersOutByThen = finishOrder.slice(0, lastWinnerPosition + 1)
        .filter(id => losingTeamIds.includes(id)).length;

    const losersRemaining = losingTeamIds.length - losersOutByThen;

    return losersRemaining;
}

/**
 * Calculate points for 2 Red Ten vs 4 Regulars
 */
export function calculate2v4Points(
    finishOrder: string[],
    redTenIds: string[],
    regularIds: string[]
): { redTenPoints: number; regularPoints: number } {
    const firstPlace = finishOrder[0];
    const secondPlace = finishOrder[1];
    const thirdPlace = finishOrder[2];
    const fourthPlace = finishOrder[3];
    const fifthPlace = finishOrder[4];

    const isRedTenFirst = redTenIds.includes(firstPlace);

    if (isRedTenFirst) {
        // Red tens win
        const isRedTenSecond = redTenIds.includes(secondPlace);

        if (isRedTenSecond) {
            // Red tens 1st and 2nd: winners gain 8, losers lose 4
            return { redTenPoints: 8, regularPoints: -4 };
        } else {
            // Red tens 1st and (3rd/4th/5th): winners gain 4, losers lose 2
            return { redTenPoints: 4, regularPoints: -2 };
        }
    } else {
        // Regulars win
        const isRegularSecond = regularIds.includes(secondPlace);
        const isRegularThird = regularIds.includes(thirdPlace);
        const isRegularFourth = regularIds.includes(fourthPlace);

        if (isRegularSecond && isRegularThird && isRegularFourth) {
            // Regulars 1st, 2nd, 3rd, 4th: regulars gain 4, red tens lose 8
            return { redTenPoints: -8, regularPoints: 4 };
        } else {
            // Regulars win any other way: regulars gain 2, red tens lose 4
            return { redTenPoints: -4, regularPoints: 2 };
        }
    }
}

/**
 * Calculate points for 1 Red Ten vs 5 Regulars
 */
export function calculate1v5Points(
    finishOrder: string[],
    redTenId: string
): { redTenPoints: number; regularPoints: number } {
    const firstPlace = finishOrder[0];
    const lastPlace = finishOrder[finishOrder.length - 1];

    if (firstPlace === redTenId) {
        // Red ten is first: red ten gains 25, everyone else loses 5
        return { redTenPoints: 25, regularPoints: -5 };
    } else if (lastPlace === redTenId) {
        // Red ten is last: red ten loses 25, everyone else gains 5
        return { redTenPoints: -25, regularPoints: 5 };
    } else {
        // Red ten is somewhere in the middle (2nd, 3rd, 4th, 5th)
        // Rule: Wash (no points change)
        return { redTenPoints: 0, regularPoints: 0 };
    }
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
    const { multiplier, red_team_player_ids } = roundData;

    // Initialize all scores to 0
    const scores: Record<string, number> = {};
    players.forEach(p => {
        scores[p.user_id] = 0;
    });

    // Need finish order to calculate
    if (!('finish_order' in roundData) || !roundData.finish_order || roundData.finish_order.length === 0) {
        return scores;
    }

    const finishOrder = roundData.finish_order;

    // Divide players into teams
    const redTeamIds = red_team_player_ids;
    const blueTeamIds = players
        .map(p => p.user_id)
        .filter(id => !redTeamIds.includes(id));

    const redTeamSize = redTeamIds.length;
    const blueTeamSize = blueTeamIds.length;

    // Determine winning team based on who got out first
    const firstOutId = finishOrder[0];
    const redWins = redTeamIds.includes(firstOutId);

    const winningTeamIds = redWins ? redTeamIds : blueTeamIds;
    const losingTeamIds = redWins ? blueTeamIds : redTeamIds;

    // Check for wash (winning team member gets out last)
    if (isWash(finishOrder, winningTeamIds)) {
        // Wash = no points change
        return scores;
    }

    // Handle different team compositions
    if (redTeamSize === 3 && blueTeamSize === 3) {
        // 3v3 scenario
        const basePoints = calculate3v3Points(finishOrder, winningTeamIds, losingTeamIds);
        const totalPoints = basePoints * multiplier;

        // Winners gain points, losers lose points
        winningTeamIds.forEach(id => {
            scores[id] = totalPoints;
        });
        losingTeamIds.forEach(id => {
            scores[id] = -totalPoints;
        });

    } else if (redTeamSize === 2 && blueTeamSize === 4) {
        // 2 Red Ten vs 4 Regulars
        const { redTenPoints, regularPoints } = calculate2v4Points(finishOrder, redTeamIds, blueTeamIds);

        // Apply multiplier
        const finalRedTenPoints = redTenPoints * multiplier;
        const finalRegularPoints = regularPoints * multiplier;

        redTeamIds.forEach(id => {
            scores[id] = finalRedTenPoints;
        });
        blueTeamIds.forEach(id => {
            scores[id] = finalRegularPoints;
        });

    } else if (redTeamSize === 4 && blueTeamSize === 2) {
        // 4 Regulars vs 2 Red Ten (inverted)
        const { redTenPoints, regularPoints } = calculate2v4Points(finishOrder, blueTeamIds, redTeamIds);

        // Apply multiplier
        const finalRedTenPoints = redTenPoints * multiplier;
        const finalRegularPoints = regularPoints * multiplier;

        blueTeamIds.forEach(id => {
            scores[id] = finalRedTenPoints;
        });
        redTeamIds.forEach(id => {
            scores[id] = finalRegularPoints;
        });

    } else if (redTeamSize === 1 && blueTeamSize === 5) {
        // 1 Red Ten vs 5 Regulars
        const redTenId = redTeamIds[0];
        const { redTenPoints, regularPoints } = calculate1v5Points(finishOrder, redTenId);

        // Note: Multiplier may or may not apply to 1v5 (not specified)
        // Applying it based on the pattern
        scores[redTenId] = redTenPoints * multiplier;
        blueTeamIds.forEach(id => {
            scores[id] = regularPoints * multiplier;
        });

    } else if (redTeamSize === 5 && blueTeamSize === 1) {
        // 5 Regulars vs 1 Red Ten (inverted)
        const redTenId = blueTeamIds[0];
        const { redTenPoints, regularPoints } = calculate1v5Points(finishOrder, redTenId);

        scores[redTenId] = redTenPoints * multiplier;
        redTeamIds.forEach(id => {
            scores[id] = regularPoints * multiplier;
        });
    }

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

/**
 * Calculate points preview for UI (base points before multiplier)
 * Works for all team compositions
 */
export function calculatePointsPreview(
    finishOrder: string[],
    redTeamIds: string[],
    allPlayerIds: string[]
): number {
    if (finishOrder.length !== 6) return 0;

    const blueTeamIds = allPlayerIds.filter(id => !redTeamIds.includes(id));
    const redTeamSize = redTeamIds.length;
    const blueTeamSize = blueTeamIds.length;

    // Determine winning team based on who got out first
    const firstOutId = finishOrder[0];
    const redWins = redTeamIds.includes(firstOutId);

    const winningTeamIds = redWins ? redTeamIds : blueTeamIds;
    const losingTeamIds = redWins ? blueTeamIds : redTeamIds;

    // Check for wash
    if (isWash(finishOrder, winningTeamIds)) {
        return 0;
    }

    // 3v3
    if (redTeamSize === 3 && blueTeamSize === 3) {
        return calculate3v3Points(finishOrder, winningTeamIds, losingTeamIds);
    }

    // 2v4 or 4v2
    if ((redTeamSize === 2 && blueTeamSize === 4) || (redTeamSize === 4 && blueTeamSize === 2)) {
        const redTenIds = redTeamSize === 2 ? redTeamIds : blueTeamIds;
        const regularIds = redTeamSize === 2 ? blueTeamIds : redTeamIds;
        const { redTenPoints } = calculate2v4Points(finishOrder, redTenIds, regularIds);
        return Math.abs(redTenPoints);
    }

    // 1v5 or 5v1
    if ((redTeamSize === 1 && blueTeamSize === 5) || (redTeamSize === 5 && blueTeamSize === 1)) {
        const redTenId = redTeamSize === 1 ? redTeamIds[0] : blueTeamIds[0];
        const { redTenPoints } = calculate1v5Points(finishOrder, redTenId);
        return Math.abs(redTenPoints);
    }

    return 0;
}

/**
 * Determine the result based on finish order
 * Winner = team of the first person out
 * 
 * IMPORTANT: finishOrder must contain all 6 player IDs for proper wash detection
 */
export function determineResult(
    finishOrder: string[],
    redTeamIds: string[]
): 'red_win' | 'blue_win' | 'wash' {
    // Need at least one player to determine winner
    if (finishOrder.length === 0) return 'wash';

    // For proper wash detection, we need all 6 players
    // If we don't have all players, we can't reliably detect wash
    if (finishOrder.length < 6) {
        // Without full finish order, determine winner based on first place only
        const firstOutId = finishOrder[0];
        return redTeamIds.includes(firstOutId) ? 'red_win' : 'blue_win';
    }

    const firstOutId = finishOrder[0];
    const redWins = redTeamIds.includes(firstOutId);

    // Derive blue team from all players in finish order minus red team
    // This is correct because finishOrder contains all 6 player IDs
    const blueTeamIds = finishOrder.filter(id => !redTeamIds.includes(id));

    const winningTeamIds = redWins ? redTeamIds : blueTeamIds;

    // Check for wash (winning team member gets out last)
    if (isWash(finishOrder, winningTeamIds)) {
        return 'wash';
    }

    return redWins ? 'red_win' : 'blue_win';
}
