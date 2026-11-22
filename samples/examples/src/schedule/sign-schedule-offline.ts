/**
 * Schedule — sign with pre-computed offline signature.
 *
 * Demonstrates using a designated payer pattern to keep a schedule
 * pending, then signing with the payer's key to trigger execution.
 *
 * In production, the payer's signature would come from an air-gapped machine:
 *   1. Serialise the ScheduleSignTransaction → bytes
 *   2. Transfer bytes to the offline signer
 *   3. Return signature bytes and attach via additionalSigners/legacySignatures
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
 * Run: pnpm tsx src/schedule/sign-schedule-offline.ts
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

    // 1. Create a payer account whose key will sign offline
    const payerKey = PrivateKey.generateED25519();
    const payerAccount = await accountService.createAccount({
        publicKey: payerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "offline payer",
    });

    console.log("Payer account created:", payerAccount.accountId);

    // 2. Schedule an AccountCreate requiring payer's signature
    const { scheduleId } = await accountService.scheduleCreateAccount(
        {
            publicKey: PrivateKey.generateED25519().publicKey.toStringRaw(),
            keyType: AccountType.ED25519,
            memo: "offline-signed schedule",
        },
        {
            scheduleMemo: "awaiting air-gapped signature",
            payerAccountId: payerAccount.accountId,
        },
    );

    console.log("Schedule created:", scheduleId);

    // 3. Sign with the payer's key (simulating offline signature delivery)
    await scheduleService.sign({
        scheduleId,
        additionalSigners: [payerKey],
    });

    console.log("Signed with payer key (simulating offline signature)");

    // 4. Verify execution
    const info = await scheduleService.getInfo(scheduleId);
    console.log("Schedule executed:", info.isExecuted);

    context.client.close();
}

void main();
