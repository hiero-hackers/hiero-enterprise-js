/**
 * Update Contract — mutate fields on an already-deployed Hiero smart
 * contract.
 *
 * Demonstrates the everyday update scenarios exposed by ContractService:
 *
 * - `updateContract` with a single field (memo) — the simplest path
 * - `updateContract` with multiple fields in one call — auto-renew period,
 *   max auto-associations, decline-staking-reward
 * - `updateContract` to rotate the admin key — both the OLD admin key
 *   AND the NEW admin key must sign
 * - `scheduleUpdateContract` — defer the update behind a scheduled
 *   transaction so additional parties can sign before it executes
 *
 * Updating any field requires the contract's current `adminKey` to sign
 * the transaction — pass it via `additionalSigners`. Contracts deployed
 * without an admin key are immutable and cannot be updated.
 *
 * `updateContract` returns nothing — the contract ID is already known to
 * the caller, and per-update status / timing is delivered through the
 * `before` / `after` listener events on the surrounding `HieroContext`.
 *
 * Run: pnpm tsx src/contract/update-contract.ts
 */

import { PrivateKey } from "@hiero-ledger/sdk";
import { ContractService, HieroContext } from "@hiero-hackers/enterprise-core";
import { getED25519Config } from "../env.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. The update sample doesn't invoke any function
 * on the contract, so a non-callable runtime keeps the deploys cheap.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

/**
 * Deploys a fresh contract with an admin key so it can be updated later.
 * Returns the contract ID and the admin key — both are required for any
 * subsequent update.
 */
async function deployMutableContract(
    contractService: ContractService,
    label: string,
): Promise<{ contractId: string; adminKey: PrivateKey }> {
    const adminKey = PrivateKey.generateED25519();
    const { contractId } = await contractService.createContract({
        bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
        gas: 150_000,
        adminKey: adminKey.publicKey,
        contractMemo: `initial ${label} memo`,
        additionalSigners: [adminKey],
    });
    console.log(`Deployed ${label} contract:`, contractId);
    return { contractId: contractId.toString(), adminKey };
}

/**
 * Demonstrates updating a single field.
 *
 * The simplest case — only `contractMemo` is sent, every other field is
 * left untouched on the network. The admin key must still sign because
 * it authorises the update itself.
 */
async function updateMemoOnly(contractService: ContractService) {
    console.log("=== Update memo only ===\n");

    const { contractId, adminKey } = await deployMutableContract(
        contractService,
        "memo-update",
    );

    await contractService.updateContract({
        contractId,
        contractMemo: "renamed via updateContract",
        additionalSigners: [adminKey],
    });

    console.log("Updated memo on:", contractId);
    console.log();
}

/**
 * Demonstrates updating several fields in a single transaction.
 *
 * Combining updates is more efficient than issuing one transaction per
 * field — same gas, same fee. Pass each field you want to change; any
 * omitted field stays as-is on the network.
 */
async function updateMultipleFields(contractService: ContractService) {
    console.log("=== Update multiple fields at once ===\n");

    const { contractId, adminKey } = await deployMutableContract(
        contractService,
        "multi-field-update",
    );

    await contractService.updateContract({
        contractId,
        contractMemo: "promoted to production",
        autoRenewPeriod: 7_948_800, // ~92 days
        maxAutomaticTokenAssociations: 10,
        declineStakingReward: true,
        additionalSigners: [adminKey],
    });

    console.log(
        "Updated memo + auto-renew + auto-assoc + staking on:",
        contractId,
    );
    console.log();
}

/**
 * Demonstrates rotating the admin key.
 *
 * Key rotation is special: both the OLD admin key (authorising the
 * change) AND the NEW admin key (proving you actually hold it) must
 * sign the update transaction. Forgetting either one yields
 * `INVALID_SIGNATURE` from the network.
 */
async function rotateAdminKey(contractService: ContractService) {
    console.log("=== Rotate the admin key ===\n");

    const { contractId, adminKey: oldAdminKey } = await deployMutableContract(
        contractService,
        "key-rotation",
    );

    const newAdminKey = PrivateKey.generateED25519();

    await contractService.updateContract({
        contractId,
        adminKey: newAdminKey.publicKey,
        additionalSigners: [oldAdminKey, newAdminKey],
    });

    console.log("Rotated admin key on:", contractId);
    console.log();
}

/**
 * Demonstrates scheduling a contract update.
 *
 * Returns a `scheduleId` immediately — the inner update is NOT executed
 * yet. Other parties sign through `ScheduleService` (or another client
 * submitting a `ScheduleSignTransaction`); once the required signatures
 * are collected, the network executes the update automatically.
 *
 * Useful for governance flows where contract changes should only land
 * after multiple approvals.
 */
async function scheduleUpdate(contractService: ContractService) {
    console.log("=== Schedule a contract update ===\n");

    const { contractId, adminKey } = await deployMutableContract(
        contractService,
        "scheduled-update",
    );

    const scheduled = await contractService.scheduleUpdateContract(
        {
            contractId,
            contractMemo: "pending council ratification",
            additionalSigners: [adminKey],
        },
        { scheduleMemo: "pending council approval" },
    );

    console.log("Schedule ID:", scheduled.scheduleId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const contractService = new ContractService(context);
    try {
        await updateMemoOnly(contractService);
        await updateMultipleFields(contractService);
        await rotateAdminKey(contractService);
        await scheduleUpdate(contractService);
        console.log("All contract update scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("update-contract sample failed:", error);
    process.exitCode = 1;
});
