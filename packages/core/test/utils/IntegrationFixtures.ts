/**
 * Common account fixtures used by the integration test suite.
 *
 * Every allowance/transfer test needs at least one funded owner account
 * (often paired with a spender), so this helper centralises the boilerplate
 * around generating a key, calling `createAccount`, and bundling the result
 * with the originating key for later signing.
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import type { AccountService } from "../../src/services/index.js";
import { AccountType } from "../../src/types/index.js";

export interface TestAccount {
    accountId: string;
    key: PrivateKey;
}

/**
 * Create a freshly-keyed ED25519 account with the given initial balance.
 */
export async function createTestAccount(
    client: AccountService,
    initialBalance = 1,
): Promise<TestAccount> {
    const key = PrivateKey.generateED25519();
    const account = await client.createAccount({
        publicKey: key.publicKey.toString(),
        keyType: AccountType.ED25519,
        initialBalance,
    });
    return { accountId: account.accountId.toString(), key };
}

/**
 * Create the standard owner+spender pair used by every allowance test.
 * Owner is funded with 10 HBAR (enough to be the treasury of a token or
 * NFT type), spender with 1 HBAR.
 *
 * Accounts are created sequentially so the operator does not collide on
 * the same nonce / transaction-id window.
 */
export async function createOwnerSpenderPair(
    client: AccountService,
): Promise<{ owner: TestAccount; spender: TestAccount }> {
    const owner = await createTestAccount(client, 10);
    const spender = await createTestAccount(client, 1);
    return { owner, spender };
}
