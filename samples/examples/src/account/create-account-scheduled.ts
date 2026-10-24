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
 * Run: pnpm tsx src/account/create-account-scheduled.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { AccountService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";
import type { ScheduleOptions } from "@hiero-hackers/enterprise-core";

async function main() {
    const context = new HieroContext(getED25519Config());

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
