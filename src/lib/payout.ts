/**
 * Optimal Payout Calculator
 * 
 * Calculates the minimum number of transactions needed for losers to pay winners.
 * Uses a greedy algorithm to minimize the number of payments.
 */

import { SessionPlayer, Transaction } from '@/types';

interface PlayerBalance {
    player: SessionPlayer;
    balance: number; // Positive = owed money, Negative = owes money
}

/**
 * Calculate optimal payout transactions to settle all debts
 * @param players - Players with their final session scores
 * @param pointValue - Dollar value per point (default: 1)
 * @returns Array of transactions from losers to winners
 */
export function calculateOptimalPayouts(
    players: SessionPlayer[],
    pointValue: number = 1
): Transaction[] {
    // Convert scores to dollar amounts
    const balances: PlayerBalance[] = players.map(player => ({
        player,
        balance: player.session_score * pointValue
    }));

    // Separate into creditors (positive balance) and debtors (negative balance)
    const creditors = balances
        .filter(b => b.balance > 0)
        .sort((a, b) => b.balance - a.balance); // Largest first

    const debtors = balances
        .filter(b => b.balance < 0)
        .map(b => ({ ...b, balance: Math.abs(b.balance) }))
        .sort((a, b) => b.balance - a.balance); // Largest first

    const transactions: Transaction[] = [];

    // Greedy algorithm: match largest debts with largest credits
    let creditorIdx = 0;
    let debtorIdx = 0;

    while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
        const creditor = creditors[creditorIdx];
        const debtor = debtors[debtorIdx];

        // Amount to transfer is the minimum of what's owed and what's due
        const amount = Math.min(creditor.balance, debtor.balance);

        if (amount > 0.01) { // Ignore tiny amounts due to floating point
            transactions.push({
                from_player: debtor.player,
                to_player: creditor.player,
                amount: Math.round(amount * 100) / 100 // Round to cents
            });
        }

        // Update balances
        creditor.balance -= amount;
        debtor.balance -= amount;

        // Move to next if balance is settled
        if (creditor.balance < 0.01) creditorIdx++;
        if (debtor.balance < 0.01) debtorIdx++;
    }

    return transactions;
}

/**
 * Get summary of final standings
 */
export function getFinalStandings(
    players: SessionPlayer[],
    pointValue: number = 1
): { player: SessionPlayer; dollarAmount: number }[] {
    return players
        .map(player => ({
            player,
            dollarAmount: player.session_score * pointValue
        }))
        .sort((a, b) => b.dollarAmount - a.dollarAmount);
}

/**
 * Calculate total money in play (should sum to 0)
 */
export function getTotalInPlay(players: SessionPlayer[], pointValue: number = 1): number {
    return players.reduce((sum, p) => sum + p.session_score * pointValue, 0);
}

/**
 * Verify the payout transactions balance correctly
 */
export function verifyPayouts(transactions: Transaction[]): boolean {
    const netFlow: Record<string, number> = {};

    for (const t of transactions) {
        netFlow[t.from_player.id] = (netFlow[t.from_player.id] || 0) - t.amount;
        netFlow[t.to_player.id] = (netFlow[t.to_player.id] || 0) + t.amount;
    }

    // Sum should be approximately 0
    const total = Object.values(netFlow).reduce((sum, v) => sum + v, 0);
    return Math.abs(total) < 0.01;
}
