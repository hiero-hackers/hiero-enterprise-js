/**
 * Create Contract Flow — deploy a Hiero smart contract whose bytecode
 * is too large to embed inline (~6KB / HIP-435), in a single call.
 *
 * `ContractCreateFlow` orchestrates the full deploy sequence:
 *
 *  1. `FileCreate` — uploads the first 2KB of bytecode.
 *  2. `FileAppend` — chunks any remaining bytecode (capped by `maxChunks`).
 *  3. `ContractCreate` — deploys the contract against the uploaded file.
 *  4. `FileDelete` — cleans up the bytecode file.
 *
 * For smaller contracts (≤ ~6KB) prefer `createContract` with the
 * `bytecode` field — one transaction, lower fees. For pre-uploaded
 * bytecode prefer `createContract` with `bytecodeFileId`. Use the flow
 * when you have raw bytecode in hand and don't want to manage the file
 * upload yourself.
 *
 * Flows do not accept `TransactionOptions` (max fee, memo, validity
 * duration, node pinning) because each inner transaction is built
 * internally. Only `additionalSigners` / `externalSigners` carry over.
 * Flows also cannot be scheduled — use the regular `createContract` /
 * `scheduleCreateContract` path if you need scheduling.
 *
 * Run: pnpm tsx src/contract/create-contract-flow.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { ContractService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. The sample doesn't invoke any function on the
 * contract, so a non-callable runtime keeps the deploys cheap.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

/**
 * Demonstrates the simplest flow deploy — operator pays for every inner
 * transaction; no admin key, so the contract is immutable.
 */
async function deployImmutableViaFlow(contractService: ContractService) {
    console.log("=== Deploy immutable contract via flow ===\n");

    const { contractId } = await contractService.createContractFlow({
        bytecode: MINIMAL_BYTECODE_HEX,
        gas: 150_000,
        contractMemo: "deployed via flow — immutable",
    });

    console.log("Deployed contract:", contractId);
    console.log();
}

/**
 * Demonstrates deploying with an admin key so the contract stays
 * mutable. The admin key must sign every inner transaction; pass it via
 * `additionalSigners` and the flow forwards it through.
 */
async function deployMutableViaFlow(contractService: ContractService) {
    console.log("=== Deploy mutable contract via flow ===\n");

    const adminKey = PrivateKey.generateED25519();

    const { contractId } = await contractService.createContractFlow({
        bytecode: MINIMAL_BYTECODE_HEX,
        gas: 150_000,
        adminKey: adminKey.publicKey,
        contractMemo: "deployed via flow — mutable",
        additionalSigners: [adminKey],
    });

    console.log("Deployed contract:", contractId);
    console.log(
        "(Admin key kept in-memory — store it to later update / delete.)",
    );
    console.log();
}

/**
 * Demonstrates capping the FileAppend chunk count.
 *
 * `maxChunks` is useful as a safety rail when you don't fully trust the
 * size of incoming bytecode (e.g., user-provided) — the flow will fail
 * fast rather than spending fees on a runaway upload.
 */
async function deployWithChunkCap(contractService: ContractService) {
    console.log("=== Deploy with maxChunks cap ===\n");

    const { contractId } = await contractService.createContractFlow({
        bytecode: MINIMAL_BYTECODE_HEX,
        gas: 150_000,
        maxChunks: 4,
        contractMemo: "chunk-capped flow deploy",
    });

    console.log("Deployed contract:", contractId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const contractService = new ContractService(context);
    try {
        await deployImmutableViaFlow(contractService);
        await deployMutableViaFlow(contractService);
        await deployWithChunkCap(contractService);
        console.log("All contract create-flow scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("create-contract-flow sample failed:", error);
    process.exitCode = 1;
});
