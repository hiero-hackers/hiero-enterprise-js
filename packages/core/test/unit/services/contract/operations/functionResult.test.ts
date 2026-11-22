import { describe, it, expect } from "vitest";
import type { TransactionResponse } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../../../src/context/index.js";
import { fetchFunctionResult } from "../../../../../src/services/contract/operations/functionResult.js";

function resultFor(bytes: Uint8Array) {
    const response = {
        getRecordQuery: () => ({
            execute: () =>
                Promise.resolve({
                    contractFunctionResult: {
                        bytes,
                        gasUsed: { toNumber: () => 21_000 },
                        errorMessage: "",
                    },
                }),
        }),
    } as unknown as TransactionResponse;

    return fetchFunctionResult(
        { client: {} } as IHieroContext,
        { response, status: "SUCCESS", transactionId: "0.0.2@1.000000000" },
        "ContractService.executeContract",
    );
}

describe("fetchFunctionResult", () => {
    it("hex-encodes the return data with zero-padded lowercase bytes", async () => {
        const bytes = new Uint8Array([0x00, 0x0f, 0xab, 0xff]);

        const result = await resultFor(bytes);

        expect(result?.returnDataHex).toBe("0x000fabff");
        expect(result?.returnDataHex).toBe(
            `0x${Buffer.from(bytes).toString("hex")}`,
        );
    });

    it("returns 0x for empty return data", async () => {
        const result = await resultFor(new Uint8Array());

        expect(result?.returnDataHex).toBe("0x");
    });
});
