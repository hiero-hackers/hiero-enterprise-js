/**
 * Delete Contract — permanently remove an already-deployed Hiero smart
 * contract and transfer its remaining HBAR balance to a designated
 * account or contract.
 *
 * Demonstrates the everyday delete scenarios exposed by ContractService:
 *
 * - `deleteContract` with `transferAccountId` — sends remaining HBAR to
 *   an account (the most common path)
 * - `deleteContract` with `transferContractId` — sends remaining HBAR
 *   to another contract instead
 * - `scheduleDeleteContract` — defer the delete behind a scheduled
 *   transaction so additional parties can sign before it executes
 *
 * Deleting a contract requires the contract's `adminKey` to sign the
 * transaction — pass it via `additionalSigners`. Contracts deployed
 * without an admin key are immutable and cannot be deleted (the network
 * returns `MODIFYING_IMMUTABLE_CONTRACT`).
 *
 * Exactly one of `transferAccountId` or `transferContractId` is
 * required — the network needs a destination for the contract's
 * remaining HBAR balance.
 *
 * `deleteContract` returns nothing — per-delete status / timing is
 * delivered through the `before` / `after` listener events on the
 * surrounding `HieroContext`.
 *
 * Setup: the client is built from environment variables by
 * `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`:
 *   HIERO_NETWORK            testnet, mainnet, previewnet, or a custom name
 *   HIERO_OPERATOR_ID        account that pays the fees, e.g. 0.0.12345
 *   HIERO_OPERATOR_KEY       the operator's private key
 *   HIERO_OPERATOR_KEY_TYPE  ed25519, ecdsa or der
 * For a custom network such as local Solo, also set HIERO_NETWORK_NODES,
 * HIERO_MIRROR_NETWORK and HIERO_MIRROR_NODE_URL.
 *
 * Run: pnpm tsx src/contract/delete-contract.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import {
    ContractService,
    HieroContext,
    resolveConfigFromEnv,
} from "@hiero-hackers/enterprise-core";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. The delete sample doesn't invoke any function
 * on the contract, so a non-callable runtime keeps the deploys cheap.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

/**
 * Deploys a fresh contract with an admin key so it can be deleted later.
 * Returns the contract ID and the admin key — both are required for the
 * delete transaction.
 */
async function deployDeletableContract(
    contractService: ContractService,
    label: string,
): Promise<{ contractId: string; adminKey: PrivateKey }> {
    const adminKey = PrivateKey.generateED25519();
    const { contractId } = await contractService.createContract({
        bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
        gas: 150_000,
        adminKey: adminKey.publicKey,
        contractMemo: `${label} contract — pending delete`,
        additionalSigners: [adminKey],
    });
    console.log(`Deployed ${label} contract:`, contractId);

    return { contractId: contractId.toString(), adminKey };
}

/**
 * Demonstrates the most common delete path — funnel the remaining HBAR
 * balance to a regular account.
 */
async function deleteToAccount(contractService: ContractService) {
    console.log("=== Delete contract, transfer to account ===\n");

    const { contractId, adminKey } = await deployDeletableContract(
        contractService,
        "to-account",
    );

    await contractService.deleteContract({
        contractId,
        transferAccountId: "0.0.2", // Solo treasury — any valid account works.
        additionalSigners: [adminKey],
    });

    console.log("Deleted contract:", contractId);
    console.log();
}

/**
 * Demonstrates funnelling the remaining HBAR balance into another
 * contract instead of an account. Useful when sweeping balances across
 * a contract suite.
 */
async function deleteToContract(contractService: ContractService) {
    console.log("=== Delete contract, transfer to contract ===\n");

    const { contractId, adminKey } = await deployDeletableContract(
        contractService,
        "to-contract",
    );
    const { contractId: sinkContractId } = await deployDeletableContract(
        contractService,
        "sink",
    );

    await contractService.deleteContract({
        contractId,
        transferContractId: sinkContractId,
        additionalSigners: [adminKey],
    });

    console.log("Deleted contract:", contractId);
    console.log("Remaining balance went to:", sinkContractId);
    console.log();
}

/**
 * Demonstrates scheduling a contract delete.
 *
 * Returns a `scheduleId` immediately — the inner delete is NOT executed
 * yet. Other parties sign through `ScheduleService` (or another client
 * submitting a `ScheduleSignTransaction`); once the required signatures
 * are collected, the network executes the delete automatically.
 *
 * Useful for governance flows where contract teardown should only land
 * after multiple approvals.
 */
async function scheduleDelete(contractService: ContractService) {
    console.log("=== Schedule a contract delete ===\n");

    const { contractId, adminKey } = await deployDeletableContract(
        contractService,
        "scheduled-delete",
    );

    const scheduled = await contractService.scheduleDeleteContract(
        {
            contractId,
            transferAccountId: "0.0.2",
            additionalSigners: [adminKey],
        },
        { scheduleMemo: "pending council teardown approval" },
    );

    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    // Read the network and operator from the HIERO_* environment variables.
    const context = new HieroContext(resolveConfigFromEnv());
    const contractService = new ContractService(context);
    try {
        await deleteToAccount(contractService);
        await deleteToContract(contractService);
        await scheduleDelete(contractService);
        console.log("All contract delete scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("delete-contract sample failed:", error);
    process.exitCode = 1;
});
