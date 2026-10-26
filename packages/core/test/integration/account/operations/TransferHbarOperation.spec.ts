import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../../utils/MirrorNode.js";
import { createTestAccount } from "../../../utils/IntegrationFixtures.js";
import { AccountService } from "../../../../src/services/index.js";

describe("TransferHbarOperation [Integration]", () => {
    let client: AccountService;
    let operatorAccountId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        operatorAccountId = ctx.operatorAccountId.toString();
    });

    describe("transferHbar", () => {
        it("transfers HBAR from the operator to a recipient", async () => {
            const receiver = await createTestAccount(client, 0);

            await waitForMirrorNodeRecord();

            const before = await client.getAccountBalance(receiver.accountId);
            const beforeTinybars = BigInt(before.tinybars);

            await client.transferHbar(receiver.accountId, 1, operatorAccountId);

            await waitForMirrorNodeRecord();

            const after = await client.getAccountBalance(receiver.accountId);
            const afterTinybars = BigInt(after.tinybars);

            // Receiver pays no fees — balance increases by exactly the transfer
            expect(afterTinybars - beforeTinybars).toBe(100_000_000n);
        });

        it("transfers HBAR from a non-operator sender (requires additionalSigners)", async () => {
            const sender = await createTestAccount(client, 5);
            const receiver = await createTestAccount(client, 0);

            await waitForMirrorNodeRecord();

            const before = await client.getAccountBalance(receiver.accountId);
            const beforeTinybars = BigInt(before.tinybars);

            await client.transferHbar(receiver.accountId, 1, sender.accountId, {
                additionalSigners: [sender.key],
            });

            await waitForMirrorNodeRecord();

            const after = await client.getAccountBalance(receiver.accountId);
            const afterTinybars = BigInt(after.tinybars);

            expect(afterTinybars - beforeTinybars).toBe(100_000_000n);
        });

        it("rejects a self-transfer before submitting to the network", async () => {
            await expect(
                client.transferHbar(operatorAccountId, 1, operatorAccountId),
            ).rejects.toThrow(/must be different/);
        });
    });

    describe("scheduleTransferHbar", () => {
        it("returns a scheduleId and transactionId for a scheduled HBAR transfer", async () => {
            const receiver = await createTestAccount(client, 0);

            const result = await client.scheduleTransferHbar(
                receiver.accountId,
                1,
                operatorAccountId,
                { scheduleMemo: "integration test schedule" },
            );

            expect(result.scheduleId.toString()).toMatch(/^0\.0\.\d+$/);
        });
    });
});
