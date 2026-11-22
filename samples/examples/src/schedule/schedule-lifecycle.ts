/**
 * Schedule — full lifecycle: create, sign, query, execute.
 *
 * Demonstrates the complete scheduled transaction workflow:
 *   1. Create a designated payer account (multi-party approval)
 *   2. Schedule an AccountCreate with the payer — won't auto-execute
 *   3. Query initial state (pending)
 *   4. Sign with the payer's key to trigger execution
 *   5. Query final state (executed)
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
 * Run: pnpm tsx src/schedule/schedule-lifecycle.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    ScheduleService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";
import type { ScheduleOptions } from "@hiero-hackers/enterprise-core";

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());

    const accountService = new AccountService(context);
    const scheduleService = new ScheduleService(context);

    // 1. Create a designated payer account
    // By setting a payerAccountId on the schedule, the schedule won't execute
    // until the payer signs — enabling multi-party approval flows.
    const payerKey = PrivateKey.generateED25519();
    const payerAccount = await accountService.createAccount({
        publicKey: payerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "schedule payer",
    });

    console.log("1. Payer account created:", payerAccount.accountId);

    // 2. Schedule an AccountCreate with the payer
    const newAccountKey = PrivateKey.generateED25519();

    const scheduleOptions: ScheduleOptions = {
        scheduleMemo: "multi-party approval required",
        payerAccountId: payerAccount.accountId,
    };

    const { scheduleId } = await accountService.scheduleCreateAccount(
        {
            publicKey: newAccountKey.publicKey.toStringRaw(),
            keyType: AccountType.ED25519,
            initialBalance: new Hbar(1),
            memo: "scheduled account",
        },
        scheduleOptions,
    );

    console.log("\n2. Schedule created");
    console.log("   scheduleId:", scheduleId);

    // 3. Query initial state — should be pending (payer hasn't signed yet)
    const initialInfo = await scheduleService.getInfo(scheduleId);

    console.log("\n3. Initial state");
    console.log("   isPending:", initialInfo.isPending);
    console.log("   signerCount:", initialInfo.signerCount);

    // 4. Sign with the payer's key — this triggers execution
    await scheduleService.sign({
        scheduleId,
        additionalSigners: [payerKey],
    });

    console.log("\n4. Payer signed — schedule should execute");

    // 5. Query final state
    const finalInfo = await scheduleService.getInfo(scheduleId);

    console.log("\n5. Final state");
    console.log("   isExecuted:", finalInfo.isExecuted);
    console.log("   isPending:", finalInfo.isPending);
    console.log("   signerCount:", finalInfo.signerCount);

    context.client.close();
}

void main();
