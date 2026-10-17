import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    AccountId,
    ContractId,
    EthereumTransaction,
    EthereumTransactionDataEip1559,
    Hbar,
    PrivateKey,
    TransactionId,
    TransactionRecordQuery,
    TransactionResponse,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { TransactionExecutor } from "../../../../../src/services/transaction/index.js";
import { HieroErrorCodes } from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";

// Builds real SDK transactions; the executor and the record lookup, the
// network steps, are stubbed.

const transactionId = TransactionId.fromString("0.0.2@1700000000.000000000");
const hex = (value: string) => Uint8Array.from(Buffer.from(value, "hex"));

/** An EIP-1559 value transfer on chain 298 (0x12a), unsigned. */
const envelope = () =>
    new EthereumTransactionDataEip1559({
        chainId: hex("012a"),
        nonce: new Uint8Array(),
        maxPriorityGas: new Uint8Array(),
        maxGas: new Uint8Array(),
        gasLimit: hex("5208"),
        to: hex("0000000000000000000000000000000000000002"),
        value: new Uint8Array(),
        callData: new Uint8Array(),
        accessList: [],
        recId: new Uint8Array(),
        r: new Uint8Array(),
        s: new Uint8Array(),
    });

const result = (contractId: ContractId | null = null) => ({
    response: new TransactionResponse({
        nodeId: AccountId.fromString("0.0.3"),
        transactionHash: new Uint8Array(),
        transactionId,
    }),
    receipt: { contractId },
    status: "SUCCESS",
    transactionId: transactionId.toString(),
});

describe("EthereumOperation (via ContractService.executeEthereumTransaction)", () => {
    let service: ContractService;
    let run: ReturnType<typeof vi.spyOn>;
    let recordQuery: ReturnType<typeof vi.spyOn>;
    let signed: EthereumTransactionDataEip1559;

    /** The transaction handed to the executor. */
    const sentTx = () => run.mock.calls[0][0] as EthereumTransaction;

    beforeEach(() => {
        run = vi
            .spyOn(TransactionExecutor.prototype, "run")
            .mockResolvedValue(result() as never);
        recordQuery = vi.spyOn(TransactionRecordQuery.prototype, "execute");
        service = new ContractService(createMockContext());
        signed = envelope().sign(PrivateKey.generateECDSA());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("relays a signed envelope and its options", async () => {
        const outcome = await service.executeEthereumTransaction({
            ethereumData: signed,
            callDataFileId: "0.0.5005",
            maxGasAllowance: 2,
        });

        const tx = sentTx();
        expect(tx).toBeInstanceOf(EthereumTransaction);
        expect(tx.ethereumData).toEqual(signed.toBytes());
        expect(tx.callDataFileId?.toString()).toBe("0.0.5005");
        expect(tx.maxGasAllowance?.toTinybars().toNumber()).toBe(
            new Hbar(2).toTinybars().toNumber(),
        );
        expect(outcome).toMatchObject({
            contractId: null,
            functionResult: null,
        });
        expect(recordQuery).not.toHaveBeenCalled();
    });

    it("accepts the signed bytes directly", async () => {
        await service.executeEthereumTransaction({
            ethereumData: signed.toBytes(),
        });

        expect(sentTx().ethereumData).toEqual(signed.toBytes());
        expect(sentTx().maxGasAllowance).toBeNull();
    });

    it("returns the created contract from the receipt", async () => {
        run.mockResolvedValueOnce(
            result(ContractId.fromString("0.0.7777")) as never,
        );

        const outcome = await service.executeEthereumTransaction({
            ethereumData: signed,
        });

        expect(outcome.contractId?.toString()).toBe("0.0.7777");
    });

    it("fetches the function result from the record when asked", async () => {
        recordQuery.mockResolvedValueOnce({
            contractFunctionResult: {
                bytes: hex("2a"),
                gasUsed: { toNumber: () => 21_000 },
                errorMessage: "",
            },
        } as never);

        const outcome = await service.executeEthereumTransaction({
            ethereumData: signed,
            withFunctionResult: true,
        });

        expect(outcome.functionResult).toEqual({
            returnDataHex: "0x2a",
            gasUsed: 21_000,
            errorMessage: null,
        });
    });

    it("throws RESULT_MAPPING_FAILED when the record fetch fails after consensus", async () => {
        recordQuery.mockRejectedValueOnce(new Error("record not found"));

        await expect(
            service.executeEthereumTransaction({
                ethereumData: signed,
                withFunctionResult: true,
            }),
        ).rejects.toMatchObject({
            code: HieroErrorCodes.ResultMappingFailed,
            context: "ContractService.executeEthereumTransaction",
            transactionId: transactionId.toString(),
        });
    });

    it("rejects an unsigned envelope before submitting", async () => {
        await expect(
            service.executeEthereumTransaction({ ethereumData: envelope() }),
        ).rejects.toMatchObject({
            code: HieroErrorCodes.InputInvalid,
            message: expect.stringContaining("not signed"),
        });
        expect(run).not.toHaveBeenCalled();
    });
});
