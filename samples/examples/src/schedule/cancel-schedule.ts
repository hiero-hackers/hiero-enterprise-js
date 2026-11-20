/**
 * Schedule — cancel a pending schedule.
 *
 * A schedule can be cancelled (deleted) before it executes, but ONLY if
 * an `adminKey` was set during creation. Without an adminKey, the schedule
 * is immutable and will either execute when threshold is met or expire.
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
 * Run: pnpm tsx src/schedule/cancel-schedule.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    ScheduleService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

    const accountService = new AccountService(context);
    const scheduleService = new ScheduleService(context);

    // Create a designated payer so the schedule stays pending
    const payerKey = PrivateKey.generateED25519();
    const payerAccount = await accountService.createAccount({
        publicKey: payerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "schedule payer",
    });

    // Create a schedule with an adminKey so it can be cancelled,
    // and a payerAccountId so it doesn't auto-execute
    const adminKey = PrivateKey.generateED25519();

    const { scheduleId } = await accountService.scheduleCreateAccount(
        {
            publicKey: PrivateKey.generateED25519().publicKey.toStringRaw(),
            keyType: AccountType.ED25519,
            memo: "this will be cancelled",
            // Admin key must sign the ScheduleCreateTransaction
            additionalSigners: [adminKey],
        },
        {
            scheduleMemo: "cancellable schedule",
            adminKey: adminKey.publicKey,
            payerAccountId: payerAccount.accountId,
        },
    );

    console.log("Schedule created:", scheduleId);

    // Cancel the schedule before it executes
    await scheduleService.cancel({
        scheduleId,
        adminKey,
    });

    // Verify it was deleted
    const info = await scheduleService.getInfo(scheduleId);

    console.log("Cancelled:", info.isDeleted);

    context.client.close();
}

void main();
