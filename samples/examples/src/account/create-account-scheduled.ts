/**
 * Create Account — scheduled (deferred multi-sig).
 *
 * The inner AccountCreateTransaction is stored on-chain as a schedule.
 * Other parties submit ScheduleSignTransaction with their keys;
 * once the threshold is met the account is created automatically.
 *
 * Use for multi-party approval workflows where not all signers
 * are available at the same time.
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/account/create-account-scheduled.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";
import type { ScheduleOptions } from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

    const accountService = new AccountService(context);

    const newKey = PrivateKey.generateED25519();

    const scheduleOptions: ScheduleOptions = {
        scheduleMemo: "pending treasury approval",
        // adminKey: treasuryKey.publicKey,  // set if you need to cancel later
    };

    const scheduled = await accountService.scheduleCreateAccount(
        {
            publicKey: newKey.publicKey.toStringRaw(),
            initialBalance: 5,
            memo: "scheduled account",
        },
        scheduleOptions,
    );

    // Returns immediately — the account does NOT exist yet.
    // Other parties sign via: ScheduleSignTransaction.setScheduleId(scheduled.scheduleId)
    console.log("Schedule created");
    console.log("  scheduleId:", scheduled.scheduleId);

    context.client.close();
}

void main();
