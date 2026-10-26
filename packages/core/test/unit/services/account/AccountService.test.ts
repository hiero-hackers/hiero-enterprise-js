import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../../src/services/account/index.js";
import { createMockContext } from "../../../utils/MockContext.js";
import type { IHieroContext } from "../../../../src/context/index.js";

// The facade only exercises its own pre-delegation validation here. Operation
// internals live in their own `operations/*.test.ts` siblings, so we don't need
// to mock the SDK for these tests — the empty-array checks throw before any
// transaction is constructed.

describe("AccountService [facade validation]", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new AccountService(context);
    });

    describe("approve allowances", () => {
        it("rejects approveHbarAllowance when hbarAllowances is empty", async () => {
            await expect(
                service.approveHbarAllowance({ hbarAllowances: [] }),
            ).rejects.toThrow(/hbarAllowances must be provided/);
        });

        it("rejects approveTokenAllowance when tokenAllowances is empty", async () => {
            await expect(
                service.approveTokenAllowance({ tokenAllowances: [] }),
            ).rejects.toThrow(/tokenAllowances must be provided/);
        });

        it("rejects approveNftAllowance when nftAllowances is empty", async () => {
            await expect(
                service.approveNftAllowance({ nftAllowances: [] }),
            ).rejects.toThrow(/nftAllowances must be provided/);
        });
    });

    describe("delete allowances", () => {
        it("rejects deleteHbarAllowance when allowances is empty", async () => {
            await expect(service.deleteHbarAllowance([])).rejects.toThrow(
                /hbarAllowances must be provided/,
            );
        });

        it("rejects deleteTokenAllowance when allowances is empty", async () => {
            await expect(service.deleteTokenAllowance([])).rejects.toThrow(
                /tokenAllowances must be provided/,
            );
        });

        it("rejects deleteNftAllowance when allowances is empty", async () => {
            await expect(service.deleteNftAllowance([])).rejects.toThrow(
                /nftAllowances must be provided/,
            );
        });

        it("rejects deleteAllNftAllowances when allowances is empty", async () => {
            await expect(service.deleteAllNftAllowances([])).rejects.toThrow(
                /nftAllowances must be provided/,
            );
        });
    });
});
