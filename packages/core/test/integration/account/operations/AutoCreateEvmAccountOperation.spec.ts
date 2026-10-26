import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import { AccountService } from "../../../../src/services/index.js";

describe("AccountService.autoCreateEvmAccount [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("transfers HBAR to a cold '0x' address, auto-creating the account", async () => {
        // Generate a fresh 20-byte EVM address per run so we always exercise
        // the auto-create path rather than transferring to a pre-existing account
        // (Solo deployments persist across local runs).
        const coldAddress = `0x${randomBytes(20).toString("hex")}`;

        const result = await client.autoCreateEvmAccount({
            evmAddress: coldAddress,
            amount: 5,
        });

        // The child receipt must report the hollow account the transfer
        // created — this is the live proof that setIncludeChildren works.
        expect(result.accountId?.toString()).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.status).toBe("SUCCESS");
        expect(result.transactionId).toContain("@");
    });
});
