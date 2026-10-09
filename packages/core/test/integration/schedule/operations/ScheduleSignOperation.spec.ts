import { describe, it, expect, beforeAll } from "vitest";
import {
    AccountInfoQuery,
    KeyList,
    PrivateKey,
    type Client,
} from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { createTestAccount } from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    ScheduleService,
} from "../../../../src/services/index.js";

describe("ScheduleService.sign [Integration]", () => {
    let client: Client;
    let accountService: AccountService;
    let scheduleService: ScheduleService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        accountService = new AccountService(ctx);
        scheduleService = new ScheduleService(ctx);
    });

    async function tinybarsOf(accountId: string): Promise<number> {
        const info = await new AccountInfoQuery()
            .setAccountId(accountId)
            .execute(client);
        return info.balance.toTinybars().toNumber();
    }

    it("executes a scheduled transfer once the sender signs", async () => {
        const sender = await createTestAccount(accountService, 5);
        const receiver = await createTestAccount(accountService, 1);
        const receiverBefore = await tinybarsOf(receiver.accountId);

        const { scheduleId } = await accountService.scheduleTransferHbar(
            receiver.accountId,
            1,
            sender.accountId,
            { scheduleMemo: "integration schedule sign" },
        );
        expect((await scheduleService.getInfo(scheduleId)).isPending).toBe(
            true,
        );

        await scheduleService.sign({
            scheduleId,
            additionalSigners: [sender.key],
        });

        const info = await scheduleService.getInfo(scheduleId);
        expect(info.isExecuted).toBe(true);
        expect(info.isPending).toBe(false);
        expect(info.executedAt).not.toBeNull();
        expect(await tinybarsOf(receiver.accountId)).toBe(
            receiverBefore + 100_000_000,
        );
    });

    it("stays pending until every required key has signed", async () => {
        // The sender is controlled by a 2-of-2 key list, so it takes two
        // separate signatures to release the transfer.
        const firstKey = PrivateKey.generateED25519();
        const secondKey = PrivateKey.generateED25519();
        const sender = await accountService.createAccount({
            key: new KeyList([firstKey.publicKey, secondKey.publicKey]),
            initialBalance: 5,
        });
        const receiver = await createTestAccount(accountService, 1);

        const { scheduleId } = await accountService.scheduleTransferHbar(
            receiver.accountId,
            1,
            sender.accountId,
            { scheduleMemo: "integration schedule multi-sig" },
        );
        const created = await scheduleService.getInfo(scheduleId);

        await scheduleService.sign({
            scheduleId,
            additionalSigners: [firstKey],
        });

        const afterFirst = await scheduleService.getInfo(scheduleId);
        expect(afterFirst.isPending).toBe(true);
        expect(afterFirst.signerCount).toBe(created.signerCount + 1);

        await scheduleService.sign({
            scheduleId,
            additionalSigners: [secondKey],
        });

        const afterSecond = await scheduleService.getInfo(scheduleId);
        expect(afterSecond.isExecuted).toBe(true);
        expect(afterSecond.executedAt).not.toBeNull();
    });
});
