import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { createTestAccount } from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    ScheduleService,
} from "../../../../src/services/index.js";

describe("ScheduleService.getInfo [Integration]", () => {
    let accountService: AccountService;
    let scheduleService: ScheduleService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        scheduleService = new ScheduleService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    it("returns the metadata of a pending schedule", async () => {
        const sender = await createTestAccount(accountService, 5);
        const receiver = await createTestAccount(accountService, 1);
        const adminKey = PrivateKey.generateED25519();

        // The sender's signature is missing, so the schedule stays pending.
        const { scheduleId } = await accountService.scheduleTransferHbar(
            receiver.accountId,
            1,
            sender.accountId,
            {
                adminKey: adminKey.publicKey,
                scheduleMemo: "integration schedule info",
                additionalSigners: [adminKey],
            },
        );

        const info = await scheduleService.getInfo(scheduleId);
        expect(info.scheduleId).toBe(scheduleId.toString());
        expect(info.scheduleMemo).toBe("integration schedule info");
        expect(info.creatorAccountId).toBe(operatorId);
        expect(info.isPending).toBe(true);
        expect(info.isExecuted).toBe(false);
        expect(info.isDeleted).toBe(false);
        expect(info.executedAt).toBeNull();
        expect(info.deletedAt).toBeNull();
        expect(info.expiresAt).not.toBeNull();
        expect(info.scheduledTransactionId).not.toBeNull();
        expect(info.waitForExpiry).toBe(false);
    });

    it("rejects an unknown schedule id", async () => {
        await expect(scheduleService.getInfo("0.0.999999999")).rejects.toThrow(
            /INVALID_SCHEDULE_ID/,
        );
    });
});
