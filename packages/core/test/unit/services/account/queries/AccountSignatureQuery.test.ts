import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    AccountInfoQuery as SdkAccountInfoQuery,
    ContractId,
    KeyList,
    PrivateKey,
    Query,
    TransactionId,
    TransferTransaction,
    type AccountInfo,
    type Key,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK queries and verifies with real keys; only Query.execute,
// the network call, is stubbed. Its response is plain data, because
// AccountInfo has no public constructor.

const accountKey = PrivateKey.generateED25519();
const message = new Uint8Array([1, 2, 3]);
const signature = accountKey.sign(message);

const accountInfo = (key: Key) => ({ key }) as AccountInfo;

/** A frozen transaction signed by the account key. */
async function signedTransaction() {
    const tx = new TransferTransaction()
        .setNodeAccountIds([AccountId.fromString("0.0.3")])
        .setTransactionId(TransactionId.generate("0.0.999"))
        .freeze();
    return await tx.sign(accountKey);
}

describe("AccountSignatureQuery (via AccountService)", () => {
    let service: AccountService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The query sent to the network. */
    const sentQuery = () => execute.mock.contexts[0] as SdkAccountInfoQuery;

    beforeEach(() => {
        execute = vi
            .spyOn(Query.prototype, "execute")
            .mockResolvedValue(accountInfo(accountKey.publicKey));
        service = new AccountService(createMockContext());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("verifyAccountSignature", () => {
        it("returns true when the account key verifies the signature", async () => {
            const result = await service.verifyAccountSignature(
                "0.0.999",
                message,
                signature,
            );

            expect(result).toBe(true);
            expect(sentQuery()).toBeInstanceOf(SdkAccountInfoQuery);
            expect(sentQuery().accountId?.toString()).toBe("0.0.999");
        });

        it("returns false when the account key rejects the signature", async () => {
            const otherSignature = PrivateKey.generateED25519().sign(message);

            const result = await service.verifyAccountSignature(
                "0.0.999",
                message,
                otherSignature,
            );

            expect(result).toBe(false);
        });

        it("returns false when the account is multi-sig (KeyList)", async () => {
            // The signature is valid for a key in the list, so false means
            // the list was not verified at all.
            execute.mockResolvedValueOnce(
                accountInfo(new KeyList([accountKey.publicKey])),
            );

            const result = await service.verifyAccountSignature(
                "0.0.999",
                message,
                signature,
            );

            expect(result).toBe(false);
        });

        it("returns false when the account is contract-controlled (ContractId)", async () => {
            execute.mockResolvedValueOnce(
                accountInfo(ContractId.fromString("0.0.5")),
            );

            const result = await service.verifyAccountSignature(
                "0.0.999",
                message,
                signature,
            );

            expect(result).toBe(false);
        });

        it("wraps query failures with a normalized error", async () => {
            execute.mockRejectedValueOnce(new Error("network down"));

            await expect(
                service.verifyAccountSignature("0.0.999", message, signature),
            ).rejects.toMatchObject({
                name: "HieroError",
                context: "AccountService.verifyAccountSignature",
                message: expect.stringMatching(/network down/),
            });
        });
    });

    describe("verifyAccountTransaction", () => {
        it("returns true when the account key signed the transaction", async () => {
            const tx = await signedTransaction();

            const result = await service.verifyAccountTransaction(
                "0.0.999",
                tx,
            );

            expect(result).toBe(true);
            expect(sentQuery().accountId?.toString()).toBe("0.0.999");
        });

        it("returns false when the account is multi-sig (KeyList)", async () => {
            execute.mockResolvedValueOnce(
                accountInfo(new KeyList([accountKey.publicKey])),
            );

            const result = await service.verifyAccountTransaction(
                "0.0.999",
                await signedTransaction(),
            );

            expect(result).toBe(false);
        });

        it("wraps query failures with a normalized error", async () => {
            execute.mockRejectedValueOnce(new Error("query failed"));

            await expect(
                service.verifyAccountTransaction(
                    "0.0.999",
                    await signedTransaction(),
                ),
            ).rejects.toMatchObject({
                name: "HieroError",
                context: "AccountService.verifyAccountTransaction",
                message: expect.stringMatching(/query failed/),
            });
        });
    });
});
