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
 * Run: pnpm tsx src/schedule/sign-schedule-offline.ts
 */

import { PrivateKey, Hbar } from "@hiero-ledger/sdk";
import {
    AccountService,
    AccountType,
    ScheduleService,
    HieroContext,
} from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());

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
