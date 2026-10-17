import { describe, it, expect, beforeAll } from "vitest";
import {
    setupIntegrationTestEnv,
    IntegrationTracker,
} from "../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../utils/mirror-node.js";
import { createTestAccount } from "../../utils/integration-fixtures.js";
import { AccountService, NetworkService } from "../../../src/services/index.js";

describe("NetworkService [Integration]", () => {
    let accountService: AccountService;
    let networkService: NetworkService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        networkService = new NetworkService(ctx);
    });

    describe("getTransactionReceipt", () => {
        it("fetches the receipt for a transaction submitted via another service", async () => {
            // Submit any transaction — the IntegrationTracker hooks the
            // resulting transaction ID so we can query it back through the
            // network service as if it had been submitted out-of-band.
            await createTestAccount(accountService, 1);
            const submittedTxId = IntegrationTracker.lastTransactionId;

            expect(submittedTxId).toBeTruthy();

            const receipt = await networkService.getTransactionReceipt({
                transactionId: submittedTxId!,
            });

            expect(receipt.status.toString()).toBe("SUCCESS");
            expect(receipt.accountId).toBeDefined();
        }, 60_000);
    });

    describe("getTransactionRecord", () => {
        it("fetches the full record for a transaction by ID", async () => {
            await createTestAccount(accountService, 1);
            const submittedTxId = IntegrationTracker.lastTransactionId;

            expect(submittedTxId).toBeTruthy();

            const record = await networkService.getTransactionRecord({
                transactionId: submittedTxId!,
            });

            expect(record.receipt.status.toString()).toBe("SUCCESS");
            expect(record.transactionId.toString()).toBe(submittedTxId);
            // Records include transfer entries — the new-account credit
            // appears here even though no explicit transfer was made.
            expect(record.transfers.length).toBeGreaterThan(0);
        }, 60_000);

        // Mirror-node fallback is wired up so the record stays observable
        // after the network's record-retention window expires.
        it("waits for mirror node availability after the record query", async () => {
            await createTestAccount(accountService, 1);

            await networkService.getTransactionRecord({
                transactionId: IntegrationTracker.lastTransactionId!,
            });

            await waitForMirrorNodeRecord();
        }, 60_000);
    });

    describe("getNetworkVersionInfo", () => {
        it("returns the running HAPI and protobuf versions", async () => {
            const version = await networkService.getNetworkVersionInfo();

            expect(version.protobufVersion).toBeDefined();
            expect(version.servicesVersion).toBeDefined();
            expect(typeof version.servicesVersion.major).toBe("number");
            expect(typeof version.servicesVersion.minor).toBe("number");
            expect(typeof version.servicesVersion.patch).toBe("number");
        }, 60_000);
    });

    describe("getAddressBook", () => {
        it("lists the network's consensus nodes from the mirror node", async () => {
            const book = await networkService.getAddressBook();

            expect(book.nodeAddresses.length).toBeGreaterThan(0);
            for (const node of book.nodeAddresses) {
                expect(node.accountId?.toString()).toMatch(/^\d+\.\d+\.\d+$/);
            }
        }, 60_000);

        it("honours the limit", async () => {
            const book = await networkService.getAddressBook({ limit: 1 });

            expect(book.nodeAddresses).toHaveLength(1);
        }, 60_000);
    });
});
