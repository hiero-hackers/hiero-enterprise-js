import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
    FeeEstimateMode,
    Hbar,
    PrivateKey,
    TransferTransaction,
    type Client,
} from "@hiero-ledger/sdk";
import {
    setupIntegrationTestEnv,
    IntegrationTracker,
} from "../../utils/Env.js";
import { waitForMirrorNodeRecord } from "../../utils/MirrorNode.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../utils/IntegrationFixtures.js";
import { resolveConfigFromEnv } from "../../../src/config/index.js";
import { HieroContext } from "../../../src/context/index.js";
import { HieroError } from "../../../src/errors/index.js";
import { AccountService, NetworkService } from "../../../src/services/index.js";
import { OperatorKeyType } from "../../../src/types/index.js";

describe("NetworkService [Integration]", () => {
    let client: Client;
    let accountService: AccountService;
    let networkService: NetworkService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
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
        let other: TestAccount;

        beforeAll(async () => {
            // The env operator is a system account that pays no fees.
            payer = await createTestAccount(accountService, 10);
            other = await createTestAccount(accountService, 10);
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

        // Two senders, so a second signature must be priced as an extra.
        const transfer = () =>
            new TransferTransaction()
                .addHbarTransfer(payer.accountId, Hbar.fromTinybars(-1))
                .addHbarTransfer(other.accountId, Hbar.fromTinybars(-1))
                .addHbarTransfer("0.0.2", Hbar.fromTinybars(2))
                .freezeWith(payerCtx.client);

        it("estimates close to the fee the network charges, signatures included", async () => {
            const tx = transfer();
            await tx.sign(payer.key);
            await tx.sign(other.key);

            const estimate = await new NetworkService(payerCtx).estimateFee(tx);
            const response = await tx.execute(payerCtx.client);
            const record = await response.getRecord(payerCtx.client);

            // Tinybars to tinycents with the rate the network applied.
            const rate = record.receipt.exchangeRate!;
            const charged =
                (record.transactionFee.toTinybars().toNumber() * rate.cents) /
                rate.hbars;
            expect(estimate.node.extras).toContainEqual(
                expect.objectContaining({ name: "SIGNATURES", count: 2 }),
            );
            expect(
                Math.abs(charged - Number(estimate.total)) / charged,
            ).toBeLessThan(0.05);
        }, 60_000);

        it("estimates in STATE mode", async () => {
            const estimate = await new NetworkService(payerCtx).estimateFee(
                transfer(),
                { mode: FeeEstimateMode.STATE },
            );

            expect(BigInt(estimate.total)).toBeGreaterThan(0n);
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

    describe("submitBatch", () => {
        const batchKey = PrivateKey.generateED25519();

        /** An HBAR transfer from `from` to `to`, batchified and signed. */
        async function batchedTransfer(
            from: TestAccount,
            to: TestAccount,
            hbar: number,
        ) {
            const tx = await new TransferTransaction()
                .addHbarTransfer(from.accountId, new Hbar(-hbar))
                .addHbarTransfer(to.accountId, new Hbar(hbar))
                .batchify(client, batchKey.publicKey);

            return await tx.sign(from.key);
        }

        async function tinybars(account: TestAccount) {
            return (await accountService.getAccountBalance(account.accountId))
                .tinybars;
        }

        it("lands every inner transfer", async () => {
            const alice = await createTestAccount(accountService, 10);
            const bob = await createTestAccount(accountService, 10);

            const result = await networkService.submitBatch({
                transactions: [
                    await batchedTransfer(alice, bob, 2),
                    await batchedTransfer(bob, alice, 1),
                ],
                batchKeys: [batchKey],
            });

            expect(result.status).toBe("SUCCESS");
            expect(result.innerTransactionIds).toHaveLength(2);

            for (const transactionId of result.innerTransactionIds) {
                const receipt = await networkService.getTransactionReceipt({
                    transactionId,
                });
                expect(receipt.status.toString()).toBe("SUCCESS");
            }

            await waitForMirrorNodeRecord();
            expect(await tinybars(alice)).toBe(String(9 * 100_000_000));
            expect(await tinybars(bob)).toBe(String(11 * 100_000_000));
        }, 120_000);

        it("needs no batchKeys when the operator is the batch key", async () => {
            const alice = await createTestAccount(accountService, 10);
            const bob = await createTestAccount(accountService, 10);
            const tx = await new TransferTransaction()
                .addHbarTransfer(alice.accountId, new Hbar(-1))
                .addHbarTransfer(bob.accountId, new Hbar(1))
                .batchify(client, client.operatorPublicKey!);
            await tx.sign(alice.key);

            const result = await networkService.submitBatch({
                transactions: [tx],
            });

            expect(result.status).toBe("SUCCESS");
        }, 120_000);

        it("lands nothing when an inner transfer fails", async () => {
            const alice = await createTestAccount(accountService, 10);
            const bob = await createTestAccount(accountService, 10);

            const error = await networkService
                .submitBatch({
                    transactions: [
                        await batchedTransfer(alice, bob, 2),
                        // Bob holds 10 HBAR, so this one fails.
                        await batchedTransfer(bob, alice, 100),
                    ],
                    batchKeys: [batchKey],
                })
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(HieroError);
            expect(error).toMatchObject({
                sdkStatus: "INNER_TRANSACTION_FAILED",
                transactionId: expect.any(String),
            });
            expect((error as HieroError).innerTransactionIds).toHaveLength(2);

            // The failed batch still reaches consensus and the mirror node.
            IntegrationTracker.lastTransactionId = (
                error as HieroError
            ).transactionId;
            await waitForMirrorNodeRecord();
            expect(await tinybars(alice)).toBe(String(10 * 100_000_000));
            expect(await tinybars(bob)).toBe(String(10 * 100_000_000));
        }, 120_000);
    });
});
