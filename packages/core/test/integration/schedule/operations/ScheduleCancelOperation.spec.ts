import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    ScheduleService,
} from "../../../../src/services/index.js";

describe("ScheduleService.cancel [Integration]", () => {
    let accountService: AccountService;
    let scheduleService: ScheduleService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        scheduleService = new ScheduleService(ctx);
    });

    /** Schedule an HBAR transfer that still waits for the sender's signature. */
    async function schedulePendingTransfer(
        sender: TestAccount,
        adminKey?: PrivateKey,
    ) {
        const receiver = await createTestAccount(accountService, 1);
        const { scheduleId } = await accountService.scheduleTransferHbar(
            receiver.accountId,
            1,
            sender.accountId,
            adminKey
                ? {
                      adminKey: adminKey.publicKey,
                      scheduleMemo: "integration schedule cancel",
                      additionalSigners: [adminKey],
                  }
                : { scheduleMemo: "integration schedule cancel" },
        );
        return scheduleId;
    }

    it("deletes a pending schedule when signed by its admin key", async () => {
        const sender = await createTestAccount(accountService, 5);
        const adminKey = PrivateKey.generateED25519();
        const scheduleId = await schedulePendingTransfer(sender, adminKey);

        await scheduleService.cancel({ scheduleId, adminKey });

        const info = await scheduleService.getInfo(scheduleId);
        expect(info.isDeleted).toBe(true);
        expect(info.isPending).toBe(false);
        expect(info.isExecuted).toBe(false);
        expect(info.deletedAt).not.toBeNull();
    });

    it("rejects signing a schedule after it was cancelled", async () => {
        const sender = await createTestAccount(accountService, 5);
        const adminKey = PrivateKey.generateED25519();
        const scheduleId = await schedulePendingTransfer(sender, adminKey);

        await scheduleService.cancel({ scheduleId, adminKey });

        await expect(
            scheduleService.sign({
                scheduleId,
                additionalSigners: [sender.key],
            }),
        ).rejects.toThrow(/SCHEDULE_ALREADY_DELETED/);
    });

    it("rejects cancelling a schedule created without an admin key", async () => {
        const sender = await createTestAccount(accountService, 5);
        const scheduleId = await schedulePendingTransfer(sender);

        await expect(
            scheduleService.cancel({
                scheduleId,
                adminKey: PrivateKey.generateED25519(),
            }),
        ).rejects.toThrow(/SCHEDULE_IS_IMMUTABLE/);

        expect((await scheduleService.getInfo(scheduleId)).isPending).toBe(
            true,
        );
    });
});
