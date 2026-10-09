import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScheduleId, TokenDissociateTransaction } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenDissociateOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenDissociateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("dissociates a single token from an account", async () => {
        await service.dissociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500"],
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenDissociateTransaction);
        expect(tx.accountId?.toString()).toBe("0.0.700");
        expect(tx.tokenIds?.map(String)).toEqual(["0.0.500"]);
    });

    it("dissociates multiple tokens in a single transaction", async () => {
        await service.dissociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500", "0.0.501", "0.0.502"],
        });

        expect(run).toHaveBeenCalledTimes(1);
        expect(sentTx().tokenIds?.map(String)).toEqual([
            "0.0.500",
            "0.0.501",
            "0.0.502",
        ]);
    });

    it("sends the TokenDissociate event", async () => {
        await service.dissociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500"],
            transactionMemo: "dissociate memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenDissociateTransaction),
            expect.objectContaining({ transactionMemo: "dissociate memo" }),
            expect.objectContaining({
                type: "TokenDissociate",
                serviceName: "TokenService",
                methodName: "dissociateToken",
            }),
        );
    });

    it("schedules the built transaction with the schedule options", async () => {
        const scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);

        const result = await service.scheduleDissociateToken(
            {
                accountId: "0.0.700",
                tokenIds: ["0.0.500"],
            },
            { scheduleMemo: "pending approval" },
        );

        const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
        expect(
            (tx as TokenDissociateTransaction).tokenIds?.map(String),
        ).toEqual(["0.0.500"]);
        expect(scheduleOptions).toEqual({ scheduleMemo: "pending approval" });
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.dissociateToken({
                accountId: "",
                tokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when tokenIds is missing", async () => {
        await expect(
            service.dissociateToken({
                accountId: "0.0.700",
                tokenIds: undefined as unknown as string[],
            }),
        ).rejects.toThrow(/tokenIds is required/i);
    });

    it("throws when tokenIds is empty", async () => {
        await expect(
            service.dissociateToken({
                accountId: "0.0.700",
                tokenIds: [],
            }),
        ).rejects.toThrow(/tokenIds must contain at least one token id/i);
    });

    it("validates before scheduling", async () => {
        const scheduleRun = vi.spyOn(
            TransactionExecutor.prototype,
            "scheduleRun",
        );

        await expect(
            service.scheduleDissociateToken({
                accountId: "",
                tokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
        expect(scheduleRun).not.toHaveBeenCalled();
    });
});
