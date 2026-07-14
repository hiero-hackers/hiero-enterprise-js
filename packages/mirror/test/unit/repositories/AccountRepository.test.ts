import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccountRepository } from "../../../src/repositories/AccountRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";

describe("AccountRepository", () => {
    let repo: AccountRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new AccountRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findByAccountId to queryAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryAccount");
        await repo.findByAccountId("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123", undefined);
    });

    it("findAccount is permissive — delegates any form unchanged", async () => {
        const spy = vi.spyOn(mockClient, "queryAccount");
        for (const v of ["0.0.123", `0x${"ab".repeat(20)}`, "HIQQEXWK"]) {
            await repo.findAccount(v);
            expect(spy).toHaveBeenCalledWith(v, undefined);
        }
    });

    it("findByEvmAddress accepts a valid EVM address and delegates", async () => {
        const spy = vi.spyOn(mockClient, "queryAccount");
        const address = `0x${"ab".repeat(20)}`;
        await repo.findByEvmAddress(address);
        expect(spy).toHaveBeenCalledWith(address, undefined);
    });

    it("findByEvmAddress rejects non-EVM input", async () => {
        await expect(repo.findByEvmAddress("0.0.123")).rejects.toThrow(
            /Invalid EVM address/,
        );
        await expect(repo.findByEvmAddress("0x1234")).rejects.toThrow(
            /Invalid EVM address/,
        );
        await expect(
            repo.findByEvmAddress(`0x${"zz".repeat(20)}`),
        ).rejects.toThrow(/Invalid EVM address/);
    });

    it("findByAlias accepts a base32 alias and delegates", async () => {
        const spy = vi.spyOn(mockClient, "queryAccount");
        const alias = "HIQQEXWKW6ZC7VMR2X";
        await repo.findByAlias(alias);
        expect(spy).toHaveBeenCalledWith(alias, undefined);
    });

    it("findByAlias rejects non-base32 input (IDs, EVM addresses)", async () => {
        await expect(repo.findByAlias("0.0.123")).rejects.toThrow(
            /Invalid account alias/,
        );
        await expect(repo.findByAlias(`0x${"ab".repeat(20)}`)).rejects.toThrow(
            /Invalid account alias/,
        );
    });

    it("forwards a point-in-time timestamp to queryAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryAccount");
        const options = { timestamp: "1700000000.000000000" };
        await repo.findByAccountId("0.0.123", options);
        expect(spy).toHaveBeenCalledWith("0.0.123", options);
    });

    it("delegates getBalance to queryAccountBalance", async () => {
        const spy = vi.spyOn(mockClient, "queryAccountBalance");
        await repo.getBalance("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123", undefined);
    });

    it("forwards findTokens to queryAccountTokens", async () => {
        const spy = vi.spyOn(mockClient, "queryAccountTokens");
        await repo.findTokens("0.0.123", { limit: 50 });
        expect(spy).toHaveBeenCalledWith("0.0.123", { limit: 50 });
    });

    it("forwards balance thresholds from list to queryAccounts", async () => {
        const spy = vi.spyOn(mockClient, "queryAccounts");
        const options = {
            balance: { gte: 100_000_000_000 },
            order: "desc" as const,
        };
        await repo.list(options);
        expect(spy).toHaveBeenCalledWith(options);
    });
    it("forwards the parity-pack listings to the client", async () => {
        const options = { limit: 5 };
        const cases = [
            ["queryBalances", () => repo.listBalances(options), [options]],
            [
                "queryPendingAirdrops",
                () => repo.findPendingAirdrops("0.0.123", options),
                ["0.0.123", options],
            ],
            [
                "queryOutstandingAirdrops",
                () => repo.findOutstandingAirdrops("0.0.123", options),
                ["0.0.123", options],
            ],
            [
                "queryCryptoAllowances",
                () => repo.findCryptoAllowances("0.0.123", options),
                ["0.0.123", options],
            ],
            [
                "queryTokenAllowances",
                () => repo.findTokenAllowances("0.0.123", options),
                ["0.0.123", options],
            ],
            [
                "queryNftAllowances",
                () => repo.findNftAllowances("0.0.123", options),
                ["0.0.123", options],
            ],
        ] as const;
        for (const [clientMethod, invoke, expectedArgs] of cases) {
            const spy = vi.spyOn(mockClient, clientMethod);
            await invoke();
            expect(spy).toHaveBeenCalledWith(...expectedArgs);
        }
    });
    it("forwards findRewards to queryStakingRewards", async () => {
        const spy = vi.spyOn(mockClient, "queryStakingRewards");
        await repo.findRewards("0.0.123", { limit: 5 });
        expect(spy).toHaveBeenCalledWith("0.0.123", { limit: 5 });
    });
    it("forwards findHooks to queryHooks", async () => {
        const spy = vi.spyOn(mockClient, "queryHooks");
        await repo.findHooks("0.0.123", { hookId: 1 });
        expect(spy).toHaveBeenCalledWith("0.0.123", { hookId: 1 });
    });
    it("forwards findHookStorage to queryHookStorage", async () => {
        const spy = vi.spyOn(mockClient, "queryHookStorage");
        await repo.findHookStorage("0.0.123", 1, { limit: 2 });
        expect(spy).toHaveBeenCalledWith("0.0.123", 1, { limit: 2 });
    });
});
