import { describe, it, expect, beforeAll } from "vitest";
import { TransactionRecord } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { AccountService } from "../../../../src/services/index.js";
import type { HieroContext } from "../../../../src/context/index.js";

describe("AccountRecordsQuery (via AccountService) [Integration]", () => {
    let ctx: HieroContext;
    let client: AccountService;

    beforeAll(() => {
        ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("fetches the operator's recent records", async () => {
        // The operator pays for this transfer, so it has a recent record.
        await client.transferHbar("0.0.98", 1, ctx.operatorAccountId);

        const records = await client.getAccountRecords(ctx.operatorAccountId);

        expect(Array.isArray(records)).toBe(true);
        for (const record of records) {
            expect(record).toBeInstanceOf(TransactionRecord);
            expect(record.transactionId).toBeDefined();
        }
    });

    it("rejects a malformed account ID before reaching the network", async () => {
        await expect(client.getAccountRecords("abc")).rejects.toMatchObject({
            code: "INPUT_INVALID",
        });
    });
});
