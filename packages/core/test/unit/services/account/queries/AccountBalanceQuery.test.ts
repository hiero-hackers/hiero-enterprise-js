import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const mockQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            hbars: { toTinybars: () => ({ toString: () => "1000000" }) },
            tokens: null,
            tokenDecimals: null,
        }),
    };
    return { mockQuery };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountBalanceQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

describe("AccountBalanceQuery (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockQuery.execute.mockResolvedValue({
            hbars: { toTinybars: () => ({ toString: () => "1000000" }) },
            tokens: null,
            tokenDecimals: null,
        });

        context = createMockContext();
        service = new AccountService(context);
    });

    describe("getAccountBalance", () => {
        it("fetches the balance for the requested account", async () => {
            const balance = await service.getAccountBalance("0.0.999");

            expect(balance.accountId).toBe("0.0.999");
            expect(balance.tinybars).toBe("1000000");
            expect(balance.tokens).toEqual([]);
        });
    });

    describe("getOperatorAccountBalance", () => {
        it("fetches the balance for the operator account", async () => {
            const balance = await service.getOperatorAccountBalance();

            expect(balance.accountId).toBe("0.0.2");
            expect(balance.tinybars).toBe("1000000");
        });
    });
});
