import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScheduleId, TokenAssociateTransaction } from "@hiero-ledger/sdk";
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

describe("TokenAssociateOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as TokenAssociateTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("associates a token to an account", async () => {
        await service.associateToken({
            accountId: "0.0.700",
            tokenId: "0.0.500",
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(TokenAssociateTransaction);
        expect(tx.accountId?.toString()).toBe("0.0.700");
        expect(tx.tokenIds?.map(String)).toEqual(["0.0.500"]);
    });

    it("associates several tokens in one transaction", async () => {
        await service.associateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500", "0.0.501"],
        });

        expect(run).toHaveBeenCalledTimes(1);
        expect(sentTx().tokenIds?.map(String)).toEqual(["0.0.500", "0.0.501"]);
    });

    it("sends an empty tokenIds list to the network", async () => {
        await service.associateToken({ accountId: "0.0.700", tokenIds: [] });

        expect(sentTx().tokenIds).toEqual([]);
    });

    it("sends the TokenAssociate event", async () => {
        await service.associateToken({
            accountId: "0.0.700",
            tokenId: "0.0.500",
            transactionMemo: "associate memo",
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenAssociateTransaction),
            expect.objectContaining({ transactionMemo: "associate memo" }),
            expect.objectContaining({
                type: "TokenAssociate",
                serviceName: "TokenService",
                methodName: "associateToken",
            }),
        );
    });

    it("schedules the built transaction with the schedule options", async () => {
        const scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);

        const result = await service.scheduleAssociateToken(
            {
                accountId: "0.0.700",
                tokenId: "0.0.500",
            },
            { scheduleMemo: "pending approval" },
        );

        const [tx, , , scheduleOptions] = scheduleRun.mock.calls[0];
        expect((tx as TokenAssociateTransaction).accountId?.toString()).toBe(
            "0.0.700",
        );
        expect(scheduleOptions).toEqual({ scheduleMemo: "pending approval" });
        expect(result.scheduleId.toString()).toBe("0.0.777");
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.associateToken({
                accountId: "",
                tokenId: "0.0.500",
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.associateToken({
                accountId: "0.0.700",
                tokenId: "",
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when both tokenId and tokenIds are set", async () => {
        await expect(
            service.associateToken({
                accountId: "0.0.700",
                tokenId: "0.0.500",
                tokenIds: ["0.0.501"],
            }),
        ).rejects.toThrow(/either tokenId or tokenIds/i);
        expect(run).not.toHaveBeenCalled();
    });

    it("throws when neither tokenId nor tokenIds is set", async () => {
        await expect(
            service.associateToken({ accountId: "0.0.700" }),
        ).rejects.toThrow(/tokenId or tokenIds is required/i);
    });

    it("schedules an association of several tokens", async () => {
        const scheduleRun = vi
            .spyOn(TransactionExecutor.prototype, "scheduleRun")
            .mockResolvedValue({
                scheduleId: ScheduleId.fromString("0.0.777"),
            } as never);

        await service.scheduleAssociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500", "0.0.501"],
        });

        const tx = scheduleRun.mock.calls[0][0] as TokenAssociateTransaction;
        expect(tx.tokenIds?.map(String)).toEqual(["0.0.500", "0.0.501"]);
    });
});
