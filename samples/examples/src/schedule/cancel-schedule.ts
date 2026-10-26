/**
 * Schedule — cancel a pending schedule.
 *
 * A schedule can be cancelled (deleted) before it executes, but ONLY if
 * an `adminKey` was set during creation. Without an adminKey, the schedule
 * is immutable and will either execute when threshold is met or expire.
 *
 * Run: pnpm tsx src/schedule/cancel-schedule.ts
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
