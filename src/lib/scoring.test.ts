/**
 * Comprehensive Tests for Red 10 Scoring Logic
 * 
 * This file tests all scoring scenarios to ensure reliability with real users.
 * 
 * Run tests with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
    isWash,
    calculate3v3Points,
    calculate2v4Points,
    calculate1v5Points,
    calculateRoundScores,
    applyRoundScores,
    calculatePointsPreview,
    determineResult,
} from '@/lib/scoring';
import type { SessionPlayer, NewRoundData } from '@/types';

// Helper to create test players
function createPlayers(count: number = 6): SessionPlayer[] {
    return Array.from({ length: count }, (_, i) => ({
        user_id: `player-${i + 1}`,
        username: `Player ${i + 1}`,
        session_score: 0,
        is_guest: false,
        avatar_color: '#e74c4c',
    }));
}

// Get all player IDs
function getPlayerIds(players: SessionPlayer[]): string[] {
    return players.map(p => p.user_id);
}

describe('isWash', () => {
    it('should detect wash when winning team member finishes last', () => {
        const finishOrder = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5', 'player-6'];
        const winningTeamIds = ['player-1', 'player-2', 'player-6']; // player-6 is on winning team and last

        expect(isWash(finishOrder, winningTeamIds)).toBe(true);
    });

    it('should NOT detect wash when losing team member finishes last', () => {
        const finishOrder = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5', 'player-6'];
        const winningTeamIds = ['player-1', 'player-2', 'player-3']; // player-6 is NOT on winning team

        expect(isWash(finishOrder, winningTeamIds)).toBe(false);
    });

    it('should return false for empty finish order', () => {
        expect(isWash([], ['player-1'])).toBe(false);
    });
});

describe('calculate3v3Points', () => {
    it('should return 3 points when winning team sweeps (finishes 1st, 2nd, 3rd)', () => {
        const finishOrder = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5', 'player-6'];
        const winningTeamIds = ['player-1', 'player-2', 'player-3'];
        const losingTeamIds = ['player-4', 'player-5', 'player-6'];

        expect(calculate3v3Points(finishOrder, winningTeamIds, losingTeamIds)).toBe(3);
    });

    it('should return 2 points when one loser gets out before last winner', () => {
        // Winners: 1, 2, 3 (finish at positions 0, 1, 2)
        // Losers: 4, 5, 6 (finish at positions 3, 4, 5)
        // Last winner at index 2 (position 3)
        // At that point, 0 losers are out, 3 remain... wait that's 3 points
        // 
        // Correct scenario for 2 points:
        // Winners at positions 0, 1, 3 (indices 0, 1, 3), last winner at index 3
        // Losers: one is at position 2, two at 4, 5
        // At index 3, one loser is out, two remain = 2 points
        const finishOrder = ['player-1', 'player-2', 'player-4', 'player-3', 'player-5', 'player-6'];
        const winningTeamIds = ['player-1', 'player-2', 'player-3'];
        const losingTeamIds = ['player-4', 'player-5', 'player-6'];

        const points = calculate3v3Points(finishOrder, winningTeamIds, losingTeamIds);
        expect(points).toBe(2);
    });

    it('should return 1 point when two losers are out before last winner', () => {
        // Winners get positions 1, 4, 5 (last winner at 5, index 4)
        // Losers get positions 2, 3, 6
        // At position 5 (index 4), two losers (at pos 2, 3) are out, one remains
        const finishOrder = ['player-1', 'player-4', 'player-5', 'player-2', 'player-3', 'player-6'];
        const winningTeamIds = ['player-1', 'player-2', 'player-3'];
        const losingTeamIds = ['player-4', 'player-5', 'player-6'];

        const points = calculate3v3Points(finishOrder, winningTeamIds, losingTeamIds);
        expect(points).toBe(1);
    });
});

describe('calculate2v4Points', () => {
    const redTenIds = ['player-1', 'player-2'];
    const regularIds = ['player-3', 'player-4', 'player-5', 'player-6'];

    it('should award 8/-4 when red tens finish 1st and 2nd', () => {
        const finishOrder = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5', 'player-6'];

        const result = calculate2v4Points(finishOrder, redTenIds, regularIds);
        expect(result.redTenPoints).toBe(8);
        expect(result.regularPoints).toBe(-4);
    });

    it('should award 4/-2 when red ten 1st but not 2nd', () => {
        const finishOrder = ['player-1', 'player-3', 'player-2', 'player-4', 'player-5', 'player-6'];

        const result = calculate2v4Points(finishOrder, redTenIds, regularIds);
        expect(result.redTenPoints).toBe(4);
        expect(result.regularPoints).toBe(-2);
    });

    it('should award -8/4 when regulars get 1st, 2nd, 3rd, 4th', () => {
        const finishOrder = ['player-3', 'player-4', 'player-5', 'player-6', 'player-1', 'player-2'];

        const result = calculate2v4Points(finishOrder, redTenIds, regularIds);
        expect(result.redTenPoints).toBe(-8);
        expect(result.regularPoints).toBe(4);
    });

    it('should award -4/2 when regulars win but not 1-4', () => {
        const finishOrder = ['player-3', 'player-4', 'player-1', 'player-5', 'player-6', 'player-2'];

        const result = calculate2v4Points(finishOrder, redTenIds, regularIds);
        expect(result.redTenPoints).toBe(-4);
        expect(result.regularPoints).toBe(2);
    });
});

describe('calculate1v5Points', () => {
    const redTenId = 'player-1';
    const regularIds = ['player-2', 'player-3', 'player-4', 'player-5', 'player-6'];

    it('should award 25/-5 when red ten finishes 1st', () => {
        const finishOrder = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5', 'player-6'];

        const result = calculate1v5Points(finishOrder, redTenId);
        expect(result.redTenPoints).toBe(25);
        expect(result.regularPoints).toBe(-5);
    });

    it('should award -25/5 when red ten finishes last (6th)', () => {
        const finishOrder = ['player-2', 'player-3', 'player-4', 'player-5', 'player-6', 'player-1'];

        const result = calculate1v5Points(finishOrder, redTenId);
        expect(result.redTenPoints).toBe(-25);
        expect(result.regularPoints).toBe(5);
    });

    it('should return 0/0 (wash) when red ten is in the middle', () => {
        const finishOrder = ['player-2', 'player-1', 'player-3', 'player-4', 'player-5', 'player-6'];

        const result = calculate1v5Points(finishOrder, redTenId);
        expect(result.redTenPoints).toBe(0);
        expect(result.regularPoints).toBe(0);
    });
});

describe('calculateRoundScores', () => {
    const players = createPlayers(6);
    const playerIds = getPlayerIds(players);

    describe('3v3 scenarios', () => {
        it('should calculate correct scores for red team win with multiplier 1', () => {
            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0], playerIds[1], playerIds[2]],
                finish_order: [...playerIds], // Red sweeps: positions 1, 2, 3
                result: 'red_win'
            };

            const scores = calculateRoundScores(roundData, players);

            // Red team wins 3 points each
            expect(scores[playerIds[0]]).toBe(3);
            expect(scores[playerIds[1]]).toBe(3);
            expect(scores[playerIds[2]]).toBe(3);
            // Blue team loses 3 points each
            expect(scores[playerIds[3]]).toBe(-3);
            expect(scores[playerIds[4]]).toBe(-3);
            expect(scores[playerIds[5]]).toBe(-3);
        });

        it('should apply 2x multiplier (Call)', () => {
            const roundData: NewRoundData = {
                multiplier: 2,
                red_team_player_ids: [playerIds[0], playerIds[1], playerIds[2]],
                finish_order: [...playerIds],
                result: 'red_win'
            };

            const scores = calculateRoundScores(roundData, players);

            expect(scores[playerIds[0]]).toBe(6); // 3 * 2
            expect(scores[playerIds[5]]).toBe(-6);
        });

        it('should apply 4x multiplier (Double Call)', () => {
            const roundData: NewRoundData = {
                multiplier: 4,
                red_team_player_ids: [playerIds[0], playerIds[1], playerIds[2]],
                finish_order: [...playerIds],
                result: 'red_win'
            };

            const scores = calculateRoundScores(roundData, players);

            expect(scores[playerIds[0]]).toBe(12); // 3 * 4
            expect(scores[playerIds[5]]).toBe(-12);
        });

        it('should return 0 for all players on wash', () => {
            // Wash: winner team member finishes last
            const finishOrder = [
                playerIds[0], // Red wins (1st place)
                playerIds[1],
                playerIds[3],
                playerIds[4],
                playerIds[5],
                playerIds[2]  // Red team member last = wash
            ];

            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0], playerIds[1], playerIds[2]],
                finish_order: finishOrder,
                result: 'wash'
            };

            const scores = calculateRoundScores(roundData, players);

            // All scores should be 0
            playerIds.forEach(id => {
                expect(scores[id]).toBe(0);
            });
        });
    });

    describe('2v4 scenarios', () => {
        it('should calculate correct scores for 2 red tens vs 4 regulars', () => {
            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0], playerIds[1]], // 2 red tens
                finish_order: [playerIds[0], playerIds[1], playerIds[2], playerIds[3], playerIds[4], playerIds[5]],
                result: 'red_win'
            };

            const scores = calculateRoundScores(roundData, players);

            // Red tens 1st & 2nd: +8 each
            expect(scores[playerIds[0]]).toBe(8);
            expect(scores[playerIds[1]]).toBe(8);
            // Regulars: -4 each
            expect(scores[playerIds[2]]).toBe(-4);
            expect(scores[playerIds[3]]).toBe(-4);
        });
    });

    describe('1v5 scenarios', () => {
        it('should calculate correct scores when lone red ten wins', () => {
            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0]], // 1 red ten
                finish_order: [...playerIds],
                result: 'red_win'
            };

            const scores = calculateRoundScores(roundData, players);

            expect(scores[playerIds[0]]).toBe(25);
            expect(scores[playerIds[1]]).toBe(-5);
            expect(scores[playerIds[5]]).toBe(-5);
        });

        it('should calculate correct scores when lone red ten finishes last', () => {
            const finishOrder = [
                playerIds[1], playerIds[2], playerIds[3], playerIds[4], playerIds[5], playerIds[0]
            ];

            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0]],
                finish_order: finishOrder,
                result: 'blue_win'
            };

            const scores = calculateRoundScores(roundData, players);

            expect(scores[playerIds[0]]).toBe(-25);
            expect(scores[playerIds[1]]).toBe(5);
        });
    });

    describe('edge cases', () => {
        it('should return 0 for all when finish order is empty', () => {
            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0], playerIds[1], playerIds[2]],
                finish_order: [],
                result: 'wash'
            };

            const scores = calculateRoundScores(roundData, players);

            playerIds.forEach(id => {
                expect(scores[id]).toBe(0);
            });
        });

        it('should handle partial finish order gracefully', () => {
            const roundData: NewRoundData = {
                multiplier: 1,
                red_team_player_ids: [playerIds[0], playerIds[1], playerIds[2]],
                finish_order: [playerIds[0], playerIds[1]], // Only 2 players
                result: 'red_win'
            };

            // Should not throw, should return scores
            const scores = calculateRoundScores(roundData, players);
            expect(scores).toBeDefined();
        });
    });
});

describe('applyRoundScores', () => {
    it('should update player session scores correctly', () => {
        const players: SessionPlayer[] = [
            { user_id: 'p1', username: 'P1', session_score: 10, is_guest: false, avatar_color: '#fff' },
            { user_id: 'p2', username: 'P2', session_score: -5, is_guest: false, avatar_color: '#fff' },
        ];
        const roundScores = { 'p1': 3, 'p2': -3 };

        const updated = applyRoundScores(players, roundScores);

        expect(updated[0].session_score).toBe(13);
        expect(updated[1].session_score).toBe(-8);
    });

    it('should handle missing player in scores', () => {
        const players: SessionPlayer[] = [
            { user_id: 'p1', username: 'P1', session_score: 10, is_guest: false, avatar_color: '#fff' },
        ];
        const roundScores = { 'p2': 5 }; // p2 not in players

        const updated = applyRoundScores(players, roundScores);

        expect(updated[0].session_score).toBe(10); // unchanged
    });
});

describe('determineResult', () => {
    it('should return red_win when first player is on red team', () => {
        const finishOrder = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
        const redTeamIds = ['p1', 'p2', 'p3'];

        expect(determineResult(finishOrder, redTeamIds)).toBe('red_win');
    });

    it('should return blue_win when first player is on blue team', () => {
        // Blue team (p4, p5, p6) wins. Last player is p3 (red), not on winning team.
        // So NOT a wash.
        const finishOrder = ['p4', 'p1', 'p2', 'p5', 'p6', 'p3'];
        const redTeamIds = ['p1', 'p2', 'p3'];

        expect(determineResult(finishOrder, redTeamIds)).toBe('blue_win');
    });

    it('should return wash when winning team member finishes last', () => {
        // Red team wins (p1 is first) but p3 (red) finishes last
        const finishOrder = ['p1', 'p2', 'p4', 'p5', 'p6', 'p3'];
        const redTeamIds = ['p1', 'p2', 'p3'];

        expect(determineResult(finishOrder, redTeamIds)).toBe('wash');
    });

    it('should return wash for empty finish order', () => {
        expect(determineResult([], ['p1'])).toBe('wash');
    });

    it('should determine winner correctly with partial finish order (< 6)', () => {
        // Without full order, can't detect wash, should just return winner
        const finishOrder = ['p1', 'p4', 'p2'];
        const redTeamIds = ['p1', 'p2', 'p3'];

        const result = determineResult(finishOrder, redTeamIds);
        expect(result).toBe('red_win'); // p1 is first, p1 is red
    });
});

describe('calculatePointsPreview', () => {
    it('should return 3 for 3v3 sweep', () => {
        const finishOrder = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
        const redTeamIds = ['p1', 'p2', 'p3'];
        const allPlayerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

        const preview = calculatePointsPreview(finishOrder, redTeamIds, allPlayerIds);
        expect(preview).toBe(3);
    });

    it('should return 0 for wash', () => {
        const finishOrder = ['p1', 'p2', 'p4', 'p5', 'p6', 'p3']; // p3 (red) last
        const redTeamIds = ['p1', 'p2', 'p3'];
        const allPlayerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

        const preview = calculatePointsPreview(finishOrder, redTeamIds, allPlayerIds);
        expect(preview).toBe(0);
    });

    it('should return 0 for incomplete finish order', () => {
        const finishOrder = ['p1', 'p2', 'p3'];
        const redTeamIds = ['p1', 'p2', 'p3'];
        const allPlayerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

        const preview = calculatePointsPreview(finishOrder, redTeamIds, allPlayerIds);
        expect(preview).toBe(0);
    });
});
