import { describe, it, expect, beforeEach, vi } from "vitest";
import { TransactionRepository } from "../../../src/repositories/TransactionRepository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/client/MirrorNodeClient.js";

describe("TransactionRepository", () => {
    let repo: TransactionRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new TransactionRepository(
            mockClient as unknown as MirrorNodeClient,
        );
    });

    it("delegates findByAccount to queryTransactionsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactionsByAccount");
        await repo.findByAccount("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123", undefined);
    });

    it("forwards limit/order to queryTransactionsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactionsByAccount");
        await repo.findByAccount("0.0.123", { limit: 5, order: "desc" });
        expect(spy).toHaveBeenCalledWith("0.0.123", {
            limit: 5,
            order: "desc",
        });
    });

    it("forwards bundled type + timestamp filters to queryTransactionsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactionsByAccount");
        const options = {
            transactionType: "TOKENMINT" as const,
            timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
            order: "desc" as const,
        };
        await repo.findByAccount("0.0.123", options);
        expect(spy).toHaveBeenCalledWith("0.0.123", options);
    });

    it("forwards network-wide queries from find to queryTransactions", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactions");
        const options = {
            transactionType: "CRYPTOTRANSFER" as const,
            timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
            limit: 100,
        };
        await repo.find(options);
        expect(spy).toHaveBeenCalledWith(options);
    });

    it("delegates findById to queryTransaction", async () => {
        const spy = vi.spyOn(mockClient, "queryTransaction");
        await repo.findById("0.0.123@1234567890.000", { nonce: 1 });
        expect(spy).toHaveBeenCalledWith("0.0.123@1234567890.000", {
            nonce: 1,
        });
    });

    it("delegates findAllById to queryTransactionRows", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactionRows");
        await repo.findAllById("0.0.123-1234567890-000000000", {
            scheduled: true,
        });
        expect(spy).toHaveBeenCalledWith("0.0.123-1234567890-000000000", {
            scheduled: true,
        });
    });
});
