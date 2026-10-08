import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractCreateFlow, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

/**
 * Flows don't extend `Transaction`, so the shared `buildMockTxBundle`
 * helper doesn't apply. We inline a minimal flow mock here: chainable
 * setters, sign / signWith, and an `execute` that returns a response
 * whose receipt carries a contractId.
 */
const mocks = vi.hoisted(() => {
    const receipt = {
        status: { toString: () => "SUCCESS" },
        contractId: { toString: () => "0.0.666" },
    };
    const response = {
        transactionId: { toString: () => "0.0.123@1234567890.000000000" },
        getReceipt: vi.fn().mockResolvedValue(receipt),
    };
    const flow = {
        setBytecode: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setMaxChunks: vi.fn().mockReturnThis(),
        setInitialBalance: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setConstructorParameters: vi.fn().mockReturnThis(),
        setContractMemo: vi.fn().mockReturnThis(),
        setAutoRenewPeriod: vi.fn().mockReturnThis(),
        setAutoRenewAccountId: vi.fn().mockReturnThis(),
        setStakedAccountId: vi.fn().mockReturnThis(),
        setStakedNodeId: vi.fn().mockReturnThis(),
        setDeclineStakingReward: vi.fn().mockReturnThis(),
        setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        signWith: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(response),
    };
    return { flow, response, receipt };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractCreateFlow: vi.fn(function () {
            return mocks.flow;
        }),
    };
});

describe("ContractCreateFlowOperation (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        // re-attach the chains that vi.clearAllMocks() wipes
        mocks.response.getReceipt.mockResolvedValue(mocks.receipt);
        mocks.flow.execute.mockResolvedValue(mocks.response);
        for (const [name, fn] of Object.entries(mocks.flow)) {
            if (name !== "execute") {
                fn.mockReturnThis();
            }
        }
        context = createMockContext();
        service = new ContractService(context);
    });

    describe("createContractFlow", () => {
        it("submits a ContractCreateFlow with only required fields and returns the contractId", async () => {
            const bytecode = new Uint8Array([0x60, 0x80, 0x60, 0x40]);

            const { contractId } = await service.createContractFlow({
                bytecode,
                gas: 150_000,
            });

            expect(contractId.toString()).toBe("0.0.666");
            expect(vi.mocked(ContractCreateFlow)).toHaveBeenCalledTimes(1);
            expect(mocks.flow.setBytecode).toHaveBeenCalledWith(bytecode);
            expect(mocks.flow.setGas).toHaveBeenCalledWith(150_000);
            expect(mocks.flow.execute).toHaveBeenCalledWith(context.client);

            // No optional setters touched.
            expect(mocks.flow.setMaxChunks).not.toHaveBeenCalled();
            expect(mocks.flow.setInitialBalance).not.toHaveBeenCalled();
            expect(mocks.flow.setAdminKey).not.toHaveBeenCalled();
            expect(mocks.flow.setConstructorParameters).not.toHaveBeenCalled();
            expect(mocks.flow.setContractMemo).not.toHaveBeenCalled();
            expect(mocks.flow.setAutoRenewPeriod).not.toHaveBeenCalled();
            expect(mocks.flow.setAutoRenewAccountId).not.toHaveBeenCalled();
            expect(mocks.flow.setStakedAccountId).not.toHaveBeenCalled();
            expect(mocks.flow.setStakedNodeId).not.toHaveBeenCalled();
            expect(mocks.flow.setDeclineStakingReward).not.toHaveBeenCalled();
            expect(
                mocks.flow.setMaxAutomaticTokenAssociations,
            ).not.toHaveBeenCalled();
        });

        it("forwards every optional setter when supplied", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await service.createContractFlow({
                bytecode: "0x6080",
                gas: 200_000,
                maxChunks: 5,
                initialBalance: new Hbar(1),
                adminKey,
                contractMemo: "flow-deployed",
                autoRenewPeriod: 7_776_000,
                autoRenewAccountId: "0.0.123",
                stakedNodeId: 0,
                declineStakingReward: true,
                maxAutomaticTokenAssociations: 5,
            });

            expect(mocks.flow.setBytecode).toHaveBeenCalledWith("0x6080");
            expect(mocks.flow.setMaxChunks).toHaveBeenCalledWith(5);
            expect(mocks.flow.setInitialBalance).toHaveBeenCalled();
            expect(mocks.flow.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(mocks.flow.setContractMemo).toHaveBeenCalledWith(
                "flow-deployed",
            );
            expect(mocks.flow.setAutoRenewPeriod).toHaveBeenCalledWith(
                7_776_000,
            );
            expect(mocks.flow.setAutoRenewAccountId).toHaveBeenCalledWith(
                "0.0.123",
            );
            expect(mocks.flow.setStakedNodeId).toHaveBeenCalledWith(0);
            expect(mocks.flow.setDeclineStakingReward).toHaveBeenCalledWith(
                true,
            );
            expect(
                mocks.flow.setMaxAutomaticTokenAssociations,
            ).toHaveBeenCalledWith(5);
        });

        it("forwards stakedAccountId when supplied (mutually exclusive with stakedNodeId)", async () => {
            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                stakedAccountId: "0.0.321",
            });

            expect(mocks.flow.setStakedAccountId).toHaveBeenCalledWith(
                "0.0.321",
            );
            expect(mocks.flow.setStakedNodeId).not.toHaveBeenCalled();
        });

        it("forwards constructorParameters when supplied", async () => {
            const params = new Uint8Array([0x01, 0x02, 0x03]);

            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                constructorParameters: params,
            });

            expect(mocks.flow.setConstructorParameters).toHaveBeenCalledWith(
                params,
            );
        });

        it("registers additionalSigners on the flow before execute", async () => {
            const extraSigner = PrivateKey.generateED25519();

            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                additionalSigners: [extraSigner],
            });

            expect(mocks.flow.sign).toHaveBeenCalledWith(extraSigner);
        });

        it("registers externalSigners on the flow before execute", async () => {
            const publicKey = PrivateKey.generateED25519().publicKey;
            const signFn = vi.fn().mockResolvedValue(new Uint8Array());

            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                externalSigners: [{ publicKey, sign: signFn }],
            });

            expect(mocks.flow.signWith).toHaveBeenCalledWith(publicKey, signFn);
        });

        it("emits the after-event once when emitting the success event fails", async () => {
            vi.mocked(context.emitAfterTransaction).mockRejectedValueOnce(
                new Error("listener bug"),
            );

            await service
                .createContractFlow({
                    bytecode: new Uint8Array([0x60]),
                    gas: 150_000,
                })
                .catch(() => undefined);

            expect(context.emitAfterTransaction).toHaveBeenCalledTimes(1);
        });

        it("emits the after-event with the error and rethrows when the flow fails", async () => {
            const failure = new Error("network down");
            mocks.flow.execute.mockRejectedValueOnce(failure);

            const afterSpy = vi.spyOn(context, "emitAfterTransaction");

            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array([0x60]),
                    gas: 150_000,
                }),
            ).rejects.toThrow(/network down/);

            expect(afterSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "ContractCreate",
                    error: failure,
                }),
            );
        });

        it("wraps a non-Error rejection in an Error on the after-event", async () => {
            mocks.flow.execute.mockRejectedValueOnce("oops");

            const afterSpy = vi.spyOn(context, "emitAfterTransaction");

            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array([0x60]),
                    gas: 150_000,
                }),
            ).rejects.toThrow();

            expect(afterSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({ message: "oops" }),
                }),
            );
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array(),
                    gas: 150_000,
                }),
            ).rejects.toThrow(/bytecode must not be empty/);

            expect(vi.mocked(ContractCreateFlow)).not.toHaveBeenCalled();
        });

        it("rejects when bytecode is missing", async () => {
            await expect(
                service.createContractFlow({
                    gas: 150_000,
                } as unknown as Parameters<
                    typeof service.createContractFlow
                >[0]),
            ).rejects.toThrow(/bytecode is required/);
        });

        it("rejects when gas is missing", async () => {
            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array([0x60]),
                } as unknown as Parameters<
                    typeof service.createContractFlow
                >[0]),
            ).rejects.toThrow(/gas is required/);
        });
    });
});
