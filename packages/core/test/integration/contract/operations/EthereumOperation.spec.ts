import { describe, it, expect, beforeAll } from "vitest";
import { EthereumTransactionDataEip1559, PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/Env.js";
import {
    AccountService,
    ContractService,
} from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";
import type { HieroContext } from "../../../../src/context/index.js";

const hex = (value: string) => Uint8Array.from(Buffer.from(value, "hex"));

describe("EthereumOperation (via ContractService) [Integration]", () => {
    let ctx: HieroContext;
    let accounts: AccountService;
    let contracts: ContractService;

    beforeAll(() => {
        ctx = setupIntegrationTestEnv();
        accounts = new AccountService(ctx);
        contracts = new ContractService(ctx);
    });

    it("relays a signed EIP-1559 transfer from an ECDSA account", async () => {
        // The Ethereum sender: an ECDSA account with an EVM alias, nonce 0.
        const key = PrivateKey.generateECDSA();
        await accounts.createAccount({
            publicKey: key.publicKey.toString(),
            keyType: AccountType.ECDSA,
            alias: true,
            initialBalance: 5,
        });

        // A zero-value transfer to the operator on Solo's chain (298). The
        // sender offers no gas price; the operator covers the gas through
        // maxGasAllowance. 21000 gas is too little on consensus v0.73+.
        const ethereumData = new EthereumTransactionDataEip1559({
            chainId: hex("012a"),
            nonce: new Uint8Array(),
            maxPriorityGas: new Uint8Array(),
            maxGas: new Uint8Array(),
            gasLimit: hex("0186a0"),
            to: hex(ctx.operatorAccountId.toEvmAddress()),
            value: new Uint8Array(),
            callData: new Uint8Array(),
            accessList: [],
            recId: new Uint8Array(),
            r: new Uint8Array(),
            s: new Uint8Array(),
        }).sign(key);

        const result = await contracts.executeEthereumTransaction({
            ethereumData,
            maxGasAllowance: 2,
            withFunctionResult: true,
        });

        expect(result.status).toBe("SUCCESS");
        expect(result.functionResult?.errorMessage ?? null).toBeNull();
    }, 120_000);
});
