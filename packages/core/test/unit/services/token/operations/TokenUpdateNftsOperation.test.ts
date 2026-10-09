import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    Long,
    PrivateKey,
    TokenUpdateNftsTransaction,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; only the executor, which sends them, is
// stubbed. TokenUpdateNftsTransaction has no getters, so its setters are
// spied on to read what was set.

const receipt = {
    receipt: {},
    status: "SUCCESS",
    transactionId: "0.0.2@1700000000.000000000",
};

describe("TokenUpdateNftsOperation (via TokenService)", () => {
    let service: TokenService;
    let run: ReturnType<typeof vi.spyOn>;
    let setTokenId: ReturnType<typeof vi.spyOn>;
    let setSerialNumbers: ReturnType<typeof vi.spyOn>;
    let setMetadata: ReturnType<typeof vi.spyOn>;

    /** The serials set on the transaction. */
    const sentSerials = () => setSerialNumbers.mock.calls[0][0] as Long[];

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(receipt as never);
        setTokenId = vi.spyOn(
            TokenUpdateNftsTransaction.prototype,
            "setTokenId",
        );
        setSerialNumbers = vi.spyOn(
            TokenUpdateNftsTransaction.prototype,
            "setSerialNumbers",
        );
        setMetadata = vi.spyOn(
            TokenUpdateNftsTransaction.prototype,
            "setMetadata",
        );
        service = new TokenService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("submits with a single numeric serial coerced to Long", async () => {
        const metadata = new Uint8Array([1, 2, 3]);

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: [7],
            metadata,
        });

        expect(run.mock.calls[0][0]).toBeInstanceOf(TokenUpdateNftsTransaction);
        expect(setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(setMetadata).toHaveBeenCalledWith(metadata);

        const serials = sentSerials();
        expect(serials).toHaveLength(1);
        expect(Long.isLong(serials[0])).toBe(true);
        expect(serials[0].toNumber()).toBe(7);
    });

    it("passes Long serials through unchanged", async () => {
        const serials = [Long.fromNumber(1), Long.fromNumber(2)];

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: serials,
            metadata: new Uint8Array([9]),
        });

        expect(sentSerials()).toHaveLength(2);
        expect(sentSerials()[0]).toBe(serials[0]);
        expect(sentSerials()[1]).toBe(serials[1]);
    });

    it("supports a mixed array of numbers and Long instances", async () => {
        const longSerial = Long.fromNumber(42);

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: [1, longSerial, 3],
            metadata: new Uint8Array([1]),
        });

        const serials = sentSerials();
        expect(serials).toHaveLength(3);
        expect(Long.isLong(serials[0])).toBe(true);
        expect(serials[0].toNumber()).toBe(1);
        expect(serials[1]).toBe(longSerial);
        expect(Long.isLong(serials[2])).toBe(true);
        expect(serials[2].toNumber()).toBe(3);
    });

    it("passes the options to the executor with the TokenUpdateNfts event", async () => {
        const metadataSigner = PrivateKey.generateED25519();

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: [1],
            metadata: new Uint8Array([1]),
            transactionMemo: "rotate metadata",
            additionalSigners: [metadataSigner],
        });

        expect(run).toHaveBeenCalledWith(
            expect.any(TokenUpdateNftsTransaction),
            expect.objectContaining({
                transactionMemo: "rotate metadata",
                additionalSigners: [metadataSigner],
            }),
            expect.objectContaining({
                type: "TokenUpdateNfts",
                serviceName: "TokenService",
                methodName: "updateNfts",
            }),
        );
    });

    it("throws and never builds the transaction when serialNumbers is empty", async () => {
        await expect(
            service.updateNfts({
                tokenId: "0.0.500",
                serialNumbers: [],
                metadata: new Uint8Array([1]),
            }),
        ).rejects.toThrow(/serialNumbers must not be empty/);

        expect(setTokenId).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
    });

    it("throws and never builds the transaction when metadata is missing", async () => {
        await expect(
            service.updateNfts({
                tokenId: "0.0.500",
                serialNumbers: [1],
                metadata: undefined as unknown as Uint8Array,
            }),
        ).rejects.toThrow(/metadata is required/);

        expect(setTokenId).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
    });
});
