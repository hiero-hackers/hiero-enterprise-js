import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    Hbar,
    MirrorNodeAccountBalance,
    MirrorNodeAccountBalanceQuery,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { HieroError } from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/MockContext.js";

// Real SDK queries; only execute (the mirror node REST call) is stubbed.

describe("AccountBalanceQuery (via AccountService)", () => {
    let service: AccountService;

    beforeEach(() => {
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("HBAR balance", () => {
        let execute: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            execute = vi
                .spyOn(MirrorNodeAccountBalanceQuery.prototype, "execute")
                .mockResolvedValue(
                    new MirrorNodeAccountBalance({
                        hbars: Hbar.fromTinybars(1_000_000),
                    }),
                );
        });

        it("returns the account's HBAR balance in tinybars", async () => {
            const balance = await service.getAccountBalance("0.0.999");

            expect(balance).toEqual({
                accountId: "0.0.999",
                tinybars: "1000000",
            });
            const query = execute.mock
                .contexts[0] as MirrorNodeAccountBalanceQuery;
            expect(query.accountId?.toString()).toBe("0.0.999");
        });

        it("returns the operator account's balance", async () => {
            const balance = await service.getOperatorAccountBalance();

            expect(balance.accountId).toBe("0.0.2");
            expect(balance.tinybars).toBe("1000000");
        });

        it("reports a mirror node failure as a HieroError", async () => {
            execute.mockRejectedValueOnce(new Error("HTTP 503: unavailable"));

            await expect(
                service.getAccountBalance("0.0.999"),
            ).rejects.toMatchObject({
                constructor: HieroError,
                context: "AccountService.getAccountBalance",
            });
        });
    });
});
