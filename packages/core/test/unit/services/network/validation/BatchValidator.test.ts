import { describe, it, expect } from "vitest";
import {
    AccountId,
    BatchTransaction,
    FreezeTransaction,
    Hbar,
    PrivateKey,
    TransactionId,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import { BatchValidator } from "../../../../../src/services/network/validation/index.js";

const batchKey = PrivateKey.generateED25519();

/** A frozen inner transfer with a batch key, as `batchify` leaves it. */
function innerTransfer() {
    return new TransferTransaction()
        .addHbarTransfer("0.0.2", new Hbar(-1))
        .addHbarTransfer("0.0.3", new Hbar(1))
        .setTransactionId(TransactionId.generate("0.0.2"))
        .setBatchKey(batchKey.publicKey)
        .freeze();
}

describe("BatchValidator", () => {
    const validator = new BatchValidator();

    it.each([1, 25])("accepts %s inner transactions", (count) => {
        const transactions = Array.from({ length: count }, innerTransfer);

        expect(() =>
            validator.validate({ transactions, batchKeys: [batchKey] }),
        ).not.toThrow();
    });

    it.each([0, 26])("rejects %s inner transactions", (count) => {
        const transactions = Array.from({ length: count }, innerTransfer);

        expect(() =>
            validator.validate({ transactions, batchKeys: [batchKey] }),
        ).toThrow(/transactions must hold 1 to 25 transactions/);
    });

    it("rejects a missing transactions list", () => {
        expect(() =>
            validator.validate({
                transactions: undefined as never,
                batchKeys: [batchKey],
            }),
        ).toThrow(/transactions must hold 1 to 25 transactions/);
    });

    it("rejects an inner transaction that is not frozen", () => {
        const tx = new TransferTransaction().setBatchKey(batchKey.publicKey);

        expect(() =>
            validator.validate({ transactions: [tx], batchKeys: [batchKey] }),
        ).toThrow(/transactions\[0\] must be frozen/);
    });

    it("rejects an inner transaction without a batch key", () => {
        const tx = new TransferTransaction()
            .setTransactionId(TransactionId.generate("0.0.2"))
            .setNodeAccountIds([AccountId.fromString("0.0.3")])
            .freeze();

        expect(() =>
            validator.validate({
                transactions: [innerTransfer(), tx],
                batchKeys: [batchKey],
            }),
        ).toThrow(/transactions\[1\] must have a batch key/);
    });

    it.each([
        ["BatchTransaction", () => new BatchTransaction()],
        ["FreezeTransaction", () => new FreezeTransaction()],
    ])("rejects a %s as an inner transaction", (_name, create) => {
        expect(() =>
            validator.validate({
                transactions: [create()],
                batchKeys: [batchKey],
            }),
        ).toThrow(/transactions\[0\] is a batch or freeze transaction/);
    });

    it.each([[[]], [undefined]])("rejects batchKeys %j", (batchKeys) => {
        expect(() =>
            validator.validate({
                transactions: [innerTransfer()],
                batchKeys: batchKeys as never,
            }),
        ).toThrow(/batchKeys must hold at least one key/);
    });
});
