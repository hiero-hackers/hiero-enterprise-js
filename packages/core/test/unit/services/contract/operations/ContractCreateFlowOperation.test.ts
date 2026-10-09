import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ContractCreateFlow,
    ContractId,
    Hbar,
    PrivateKey,
    Status,
    TransactionId,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Flows don't go through TransactionExecutor, so ContractCreateFlow.execute,
// the network call, is stubbed. Its response is plain data.

const receipt = {
    status: Status.Success,
    contractId: ContractId.fromString("0.0.666"),
};
const response = {
    transactionId: TransactionId.fromString("0.0.123@1234567890.000000000"),
    getReceipt: () => Promise.resolve(receipt),
};

describe("ContractCreateFlowOperation (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;
    let execute: ReturnType<typeof vi.spyOn>;

    /** The flow sent to the network. */
    const sentFlow = () => execute.mock.contexts[0] as ContractCreateFlow;

    beforeEach(() => {
        execute = vi
            .spyOn(ContractCreateFlow.prototype, "execute")
            .mockResolvedValue(response as never);
        context = createMockContext();
        service = new ContractService(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createContractFlow", () => {
        it("deploys with only required fields, keeps SDK defaults and returns the contractId", async () => {
            const bytecode = new Uint8Array([0x60, 0x80, 0x60, 0x40]);

            const result = await service.createContractFlow({
                bytecode,
                gas: 150_000,
            });

            expect(result.contractId.toString()).toBe("0.0.666");
            expect(result.status).toBe("SUCCESS");
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");
            expect(execute).toHaveBeenCalledWith(context.client);

            const flow = sentFlow();
            const defaults = new ContractCreateFlow();
            expect(flow).toBeInstanceOf(ContractCreateFlow);
            expect(flow.bytecode).toEqual(bytecode);
            expect(flow.gas?.toNumber()).toBe(150_000);
            expect(flow.maxChunks).toEqual(defaults.maxChunks);
            expect(flow.initialBalance).toEqual(defaults.initialBalance);
            expect(flow.adminKey).toEqual(defaults.adminKey);
            expect(flow.constructorParameters).toEqual(
                defaults.constructorParameters,
            );
            expect(flow.contractMemo).toEqual(defaults.contractMemo);
            expect(flow.autoRenewPeriod).toEqual(defaults.autoRenewPeriod);
            expect(flow.autoRenewAccountId).toEqual(
                defaults.autoRenewAccountId,
            );
            expect(flow.stakedAccountId).toEqual(defaults.stakedAccountId);
            expect(flow.stakedNodeId).toEqual(defaults.stakedNodeId);
            expect(flow.declineStakingRewards).toEqual(
                defaults.declineStakingRewards,
            );
            expect(flow.maxAutomaticTokenAssociation).toEqual(
                defaults.maxAutomaticTokenAssociation,
            );
        });

        it("sets every optional field that is provided", async () => {
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

            const flow = sentFlow();
            expect(flow.bytecode).toEqual(
                new ContractCreateFlow().setBytecode("0x6080").bytecode,
            );
            expect(flow.maxChunks).toBe(5);
            expect(flow.initialBalance?.toString()).toBe(
                new Hbar(1).toString(),
            );
            expect(flow.adminKey).toBe(adminKey);
            expect(flow.contractMemo).toBe("flow-deployed");
            expect(flow.autoRenewPeriod.seconds.toNumber()).toBe(7_776_000);
            expect(flow.autoRenewAccountId?.toString()).toBe("0.0.123");
            expect(flow.stakedNodeId?.toNumber()).toBe(0);
            expect(flow.declineStakingRewards).toBe(true);
            expect(flow.maxAutomaticTokenAssociation).toBe(5);
        });

        it("sets stakedAccountId without a stakedNodeId", async () => {
            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                stakedAccountId: "0.0.321",
            });

            const flow = sentFlow();
            expect(flow.stakedAccountId?.toString()).toBe("0.0.321");
            expect(flow.stakedNodeId).toBeNull();
        });

        it("sets constructorParameters when supplied", async () => {
            const params = new Uint8Array([0x01, 0x02, 0x03]);

            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                constructorParameters: params,
            });

            expect(sentFlow().constructorParameters).toEqual(params);
        });

        it("registers additionalSigners on the flow before execute", async () => {
            // The flow exposes no getter for its signers.
            const sign = vi.spyOn(ContractCreateFlow.prototype, "sign");
            const extraSigner = PrivateKey.generateED25519();

            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                additionalSigners: [extraSigner],
            });

            expect(sign).toHaveBeenCalledWith(extraSigner);
            expect(sign.mock.contexts[0]).toBe(sentFlow());
        });

        it("registers externalSigners on the flow before execute", async () => {
            // The flow exposes no getter for its signers.
            const signWith = vi.spyOn(ContractCreateFlow.prototype, "signWith");
            const publicKey = PrivateKey.generateED25519().publicKey;
            const signFn = vi.fn().mockResolvedValue(new Uint8Array());

            await service.createContractFlow({
                bytecode: new Uint8Array([0x60]),
                gas: 150_000,
                externalSigners: [{ publicKey, sign: signFn }],
            });

            expect(signWith).toHaveBeenCalledWith(publicKey, signFn);
            expect(signWith.mock.contexts[0]).toBe(sentFlow());
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
            execute.mockRejectedValueOnce(failure);

            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array([0x60]),
                    gas: 150_000,
                }),
            ).rejects.toThrow(/network down/);

            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "ContractCreate",
                    error: failure,
                }),
            );
        });

        it("wraps a non-Error rejection in an Error on the after-event", async () => {
            execute.mockRejectedValueOnce("oops");

            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array([0x60]),
                    gas: 150_000,
                }),
            ).rejects.toThrow();

            expect(context.emitAfterTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({ message: "oops" }),
                }),
            );
        });

        it("propagates validator errors before sending the flow", async () => {
            await expect(
                service.createContractFlow({
                    bytecode: new Uint8Array(),
                    gas: 150_000,
                }),
            ).rejects.toThrow(/bytecode must not be empty/);

            expect(execute).not.toHaveBeenCalled();
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
