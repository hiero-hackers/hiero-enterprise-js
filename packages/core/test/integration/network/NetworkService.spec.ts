import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FeeEstimateMode, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import {
    setupIntegrationTestEnv,
    IntegrationTracker,
} from "../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../utils/mirror-node.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../utils/integration-fixtures.js";
import { resolveConfigFromEnv } from "../../../src/config/index.js";
import { HieroContext } from "../../../src/context/index.js";
import { AccountService, NetworkService } from "../../../src/services/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";

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

    describe("estimateFee", () => {
        let payerCtx: HieroContext;
        let payer: TestAccount;

        beforeAll(async () => {
            // The env operator is a system account that pays no fees.
            payer = await createTestAccount(accountService, 10);
            payerCtx = new HieroContext({
                ...resolveConfigFromEnv(),
                operatorId: payer.accountId,
                operatorKey: payer.key.toStringDer(),
                operatorKeyType: OperatorKeyType.DER,
            });
        });

        afterAll(() => {
            payerCtx?.close();
        });

        const transfer = () =>
            new TransferTransaction()
                .addHbarTransfer(payer.accountId, Hbar.fromTinybars(-1))
                .addHbarTransfer("0.0.2", Hbar.fromTinybars(1));

        it("estimates close to the fee the network charges", async () => {
            const tx = transfer().freezeWith(payerCtx.client);
            await tx.sign(payer.key);

            const estimate = await new NetworkService(payerCtx).estimateFee(tx);
            const response = await tx.execute(payerCtx.client);
            const record = await response.getRecord(payerCtx.client);

            // Tinybars to tinycents with the rate the network applied.
            const rate = record.receipt.exchangeRate!;
            const charged =
                (record.transactionFee.toTinybars().toNumber() * rate.cents) /
                rate.hbars;
            expect(Number(estimate.total)).toBeGreaterThan(0);
            expect(
                Math.abs(charged - Number(estimate.total)) / charged,
            ).toBeLessThan(0.05);
        }, 60_000);

        it("leaves an unfrozen transaction unfrozen", async () => {
            const tx = transfer();

            const estimate = await new NetworkService(payerCtx).estimateFee(
                tx,
                { mode: FeeEstimateMode.STATE },
            );

            expect(BigInt(estimate.total)).toBe(
                BigInt(estimate.network.subtotal) +
                    BigInt(estimate.node.base) +
                    BigInt(estimate.service.base),
            );
            expect(tx.isFrozen()).toBe(false);
        }, 60_000);
    });

    describe("generateRandom", () => {
        it("returns an integer below the range", async () => {
            const random = await networkService.generateRandom({ range: 10 });

            expect(random.status).toBe("SUCCESS");
            expect(Number.isInteger(random.prngNumber)).toBe(true);
            expect(random.prngNumber).toBeGreaterThanOrEqual(0);
            expect(random.prngNumber).toBeLessThan(10);
        }, 60_000);

        it("returns 384 bits of bytes without a range", async () => {
            const random = await networkService.generateRandom();

            expect(random.prngBytes?.length).toBe(48);
            expect(random.prngNumber).toBeNull();
        }, 60_000);
    });
});
