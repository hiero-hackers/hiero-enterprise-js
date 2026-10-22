import type { IHieroContext } from "../../context/index.js";
import type { QueryOptions, ScheduleOptions } from "../transaction/index.js";
import {
    ContractCreateOperation,
    ContractCreateFlowOperation,
    ContractExecuteOperation,
    EthereumOperation,
    ContractUpdateOperation,
    ContractDeleteOperation,
    HookStoreOperation,
} from "./operations/index.js";
import type {
    ContractCreateOperationOptions,
    ContractCreateFlowOperationOptions,
    ContractExecuteOperationOptions,
    EthereumOperationOptions,
    ContractUpdateOperationOptions,
    ContractDeleteOperationOptions,
    HookStoreOperationOptions,
} from "./operations/index.js";
import {
    ContractCallQuery,
    ContractInfoQuery,
    ContractBytecodeQuery,
    MirrorNodeContractQuery,
} from "./queries/index.js";
import type {
    ContractCallQueryOptions,
    MirrorNodeContractQueryOptions,
} from "./queries/index.js";
import type {
    ContractId,
    ContractInfo,
    ContractFunctionResult,
} from "@hiero-ledger/sdk";

/**
 * Options for deploying a smart contract via `ContractCreateTransaction`.
 *
 * Pass exactly one bytecode source:
 * - `bytecodeFileId` — references bytecode previously uploaded via
 *   `FileService.createFile`. Works for any contract size.
 * - `bytecode` — embeds raw bytecode directly in the transaction (HIP-435).
 *   Limited to ~6KB; for larger contracts without a pre-uploaded file use a
 *   `ContractCreateFlow`-backed operation instead.
 */
export type CreateContractOptions = ContractCreateOperationOptions;

/**
 * Options for deploying a contract via `ContractCreateFlow` — the SDK
 * convenience that handles bytecode upload (file create + append),
 * deploy, and cleanup (file delete) in one call.
 *
 * Use this when you don't already have the bytecode uploaded as a file
 * and it is too large to embed inline (~6KB / HIP-435). For smaller
 * bytecode prefer `createContract` with `bytecode`; for pre-uploaded
 * bytecode prefer `createContract` with `bytecodeFileId` — both of
 * those paths support scheduling, this one does not.
 */
export type CreateContractFlowOptions = ContractCreateFlowOperationOptions;

/**
 * Options for invoking a state-mutating contract function via
 * `ContractExecuteTransaction`.
 *
 * Pass exactly one call-target form:
 * - `functionName` (with optional ABI-typed `functionParameters`) — common path;
 *   the SDK encodes the call data.
 * - `rawFunctionParameters` — pre-encoded ABI bytes for advanced callers.
 *
 * For read-only state queries, use `ContractCallQuery` instead (cheaper —
 * no consensus round-trip, no gas charged on success).
 */
export type ExecuteContractOptions = ContractExecuteOperationOptions;

/**
 * Options for `ContractService.executeEthereumTransaction`: a signed,
 * RLP-encoded Ethereum transaction relayed through Hedera (HIP-410).
 */
export type ExecuteEthereumTransactionOptions = EthereumOperationOptions;

/**
 * Options for mutating fields on an already-deployed contract via
 * `ContractUpdateTransaction`.
 *
 * Only fields that are explicitly set are sent to the network; omitted
 * fields are left unchanged. Updating any field requires the contract's
 * current `adminKey` to sign — pass it via `additionalSigners`. Contracts
 * deployed without an admin key are immutable.
 */
export type UpdateContractOptions = ContractUpdateOperationOptions;

/**
 * Options for permanently deleting a contract via
 * `ContractDeleteTransaction`.
 *
 * The contract's `adminKey` must sign the transaction — pass it via
 * `additionalSigners`. Contracts deployed without an admin key are
 * immutable and cannot be deleted (network returns
 * `MODIFYING_IMMUTABLE_CONTRACT`).
 *
 * Exactly one of `transferAccountId` or `transferContractId` must be
 * provided — the network needs a destination for the contract's
 * remaining HBAR balance.
 */
export type DeleteContractOptions = ContractDeleteOperationOptions;

/**
 * Options for invoking a view / pure contract function locally via
 * `ContractCallQuery` — read-only, no consensus, no gas charged on
 * success. Use this to read on-chain state cheaply; use
 * `executeContract` to mutate state.
 */
export type CallContractOptions = ContractCallQueryOptions;

/**
 * Options for `ContractService.simulateContractCall` and
 * `ContractService.estimateContractGas`: a contract call simulated on the
 * mirror node instead of a consensus node.
 */
export type MirrorContractCallOptions = MirrorNodeContractQueryOptions;

/**
 * Options for updating an EVM hook's storage via `HookStoreTransaction`
 * (HIP-1195). The hook's owner is an account or a contract.
 */
export type UpdateHookStorageOptions = HookStoreOperationOptions;

/**
 * Service for managing smart contracts on the Hiero network (HSCS — the
 * Smart Contract Service).
 *
 * Wraps the underlying `ContractCreateTransaction` /
 * `ContractExecuteTransaction` / `ContractCallQuery` / `ContractUpdateTransaction`
 * / `ContractDeleteTransaction` / `ContractInfoQuery` / `ContractBytecodeQuery`
 * / `MirrorNodeContractCallQuery` / `MirrorNodeContractEstimateQuery` /
 * `HookStoreTransaction` SDK surface with validated, observability-aware
 * operations. Listeners
 * registered on the surrounding `HieroContext` see `before` / `after` events
 * for every contract transaction and consensus-node query submitted here;
 * the mirror node simulations emit none.
 *
 * Operations are organised internally into per-transaction classes under
 * `services/contract/operations/` (write) and `services/contract/queries/`
 * (read); validators live alongside them in `services/contract/validation/`.
 * This facade routes typed option objects to the right operation class so
 * callers never have to think about the SDK transaction class hierarchy.
 */
export class ContractService {
    private readonly createOperation: ContractCreateOperation;
    private readonly createFlowOperation: ContractCreateFlowOperation;
    private readonly executeOperation: ContractExecuteOperation;
    private readonly ethereumOperation: EthereumOperation;
    private readonly updateOperation: ContractUpdateOperation;
    private readonly deleteOperation: ContractDeleteOperation;
    private readonly hookStoreOperation: HookStoreOperation;
    private readonly callQuery: ContractCallQuery;
    private readonly infoQuery: ContractInfoQuery;
    private readonly bytecodeQuery: ContractBytecodeQuery;
    private readonly mirrorQuery: MirrorNodeContractQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new ContractCreateOperation(context);
        this.createFlowOperation = new ContractCreateFlowOperation(context);
        this.executeOperation = new ContractExecuteOperation(context);
        this.ethereumOperation = new EthereumOperation(context);
        this.updateOperation = new ContractUpdateOperation(context);
        this.deleteOperation = new ContractDeleteOperation(context);
        this.hookStoreOperation = new HookStoreOperation(context);
        this.callQuery = new ContractCallQuery(context);
        this.infoQuery = new ContractInfoQuery(context);
        this.bytecodeQuery = new ContractBytecodeQuery(context);
        this.mirrorQuery = new MirrorNodeContractQuery(context);
    }

    /**
     * Deploy a new smart contract.
     *
     * Exactly one of `bytecodeFileId` or `bytecode` must be supplied. See
     * `CreateContractOptions` for the trade-offs between the two paths.
     *
     * @param options.bytecodeFileId - FileId of previously uploaded bytecode
     * @param options.bytecode - Raw bytecode bytes embedded in-transaction (HIP-435, ~6KB max)
     * @param options.gas - Gas limit for the constructor call (required)
     * @param options.initialBalance - Funds transferred into the contract on creation
     * @param options.adminKey - Admin key required to later update / delete the contract
     * @param options.constructorParameters - Parameters passed to the contract's constructor
     * @param options.contractMemo - Memo stored on the contract entity (max 100 bytes)
     * @param options.autoRenewPeriod - Auto-renew period for the contract account
     * @param options.autoRenewAccountId - Account charged for auto-renewal fees
     * @param options.stakedAccountId - Account this contract stakes to (mutex with `stakedNodeId`)
     * @param options.stakedNodeId - Node this contract stakes to (mutex with `stakedAccountId`)
     * @param options.declineStakingReward - Decline staking reward distribution
     * @param options.maxAutomaticTokenAssociations - Allow auto-associating up to N tokens (HIP-23 / HIP-904)
     * @param options.hooks - Hooks to create with the contract (HIP-1195)
     * @returns The contract ID of the deployed contract (e.g., `"0.0.12345"`)
     *
     * @example
     * ```typescript
     * const fileId = await fileService.createFile({ contents: bytecode });
     * const contractId = await contractService.createContract({
     *     bytecodeFileId: fileId,
     *     gas: 150_000,
     *     adminKey: adminKey.publicKey,
     *     additionalSigners: [adminKey],
     * });
     * ```
     */
    async createContract(options: CreateContractOptions) {
        return await this.createOperation.execute(options);
    }

    /**
     * Schedule a contract creation for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the contract creation executes automatically.
     *
     * @param options - Same fields as `createContract`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleCreateContract(
        options: CreateContractOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.createOperation.schedule(options, scheduleOptions);
    }

    /**
     * Deploy a smart contract via `ContractCreateFlow` — the SDK
     * convenience that uploads the bytecode (via `FileCreate` +
     * `FileAppend`), deploys the contract, and cleans up the bytecode
     * file in a single call.
     *
     * Use this when the bytecode is too large to embed inline (~6KB
     * HIP-435 limit) and you don't already have it uploaded as a file.
     * For smaller bytecode or pre-uploaded files, prefer `createContract`
     * — both of those paths support scheduling, this one does not.
     *
     * Flows do not accept the regular `TransactionOptions` (max fee,
     * memo, validity duration, node pinning) because each inner
     * transaction is built internally. Only `additionalSigners` /
     * `externalSigners` carry over — the flow forwards them to every
     * inner transaction.
     *
     * @param options.bytecode - Raw bytecode (Uint8Array or hex string), required
     * @param options.gas - Gas limit for the constructor call (required)
     * @param options.maxChunks - Optional cap on `FileAppend` chunks
     * @param options.adminKey - Admin key required to later update / delete the contract
     * @param options.constructorParameters - Parameters passed to the contract's constructor
     * @param options.contractMemo - Memo stored on the contract entity (max 100 bytes)
     * @param options.initialBalance - Funds transferred into the contract on creation
     * @param options.autoRenewPeriod - Auto-renew period for the contract account
     * @param options.autoRenewAccountId - Account charged for auto-renewal fees
     * @param options.stakedAccountId - Account this contract stakes to (mutex with `stakedNodeId`)
     * @param options.stakedNodeId - Node this contract stakes to (mutex with `stakedAccountId`)
     * @param options.declineStakingReward - Decline staking reward distribution
     * @param options.maxAutomaticTokenAssociations - Allow auto-associating up to N tokens (HIP-23)
     * @returns The contract ID of the deployed contract (e.g., `"0.0.12345"`)
     *
     * @example
     * ```typescript
     * const contractId = await contractService.createContractFlow({
     *     bytecode: largeBytecodeBuffer,
     *     gas: 200_000,
     *     adminKey: adminKey.publicKey,
     *     additionalSigners: [adminKey],
     * });
     * ```
     */
    async createContractFlow(options: CreateContractFlowOptions) {
        return await this.createFlowOperation.execute(options);
    }

    /**
     * Invoke a state-mutating function on a deployed smart contract.
     *
     * Resolves once the consensus node returns a successful receipt for
     * the call, with the transaction id and status. Pass
     * `withFunctionResult: true` to also get the EVM-level outcome —
     * return data, gas used, and any revert message — distilled from the
     * transaction record. The record is a separate **paid** query, so it
     * is fetched only under that opt-in.
     *
     * For read-only state queries that don't mutate the ledger, prefer a
     * `ContractCallQuery` — no consensus round-trip, no gas charged on
     * success.
     *
     * @param options.contractId - Contract to invoke
     * @param options.gas - Gas limit for the call (required)
     * @param options.functionName - Function name to call; SDK encodes parameters
     * @param options.functionParameters - ABI-typed parameters (paired with `functionName`)
     * @param options.rawFunctionParameters - Pre-encoded ABI bytes (mutex with `functionName`)
     * @param options.payableAmount - HBAR forwarded with the call (for `payable` functions)
     * @param options.withFunctionResult - Also fetch the EVM outcome from
     *   the transaction record (an additional paid query)
     * @returns The transaction id/status; `functionResult` (return data
     *   hex, gas used, revert message) only with `withFunctionResult: true`
     *
     * @example
     * ```typescript
     * const result = await contractService.executeContract({
     *     contractId: "0.0.12345",
     *     gas: 100_000,
     *     functionName: "set",
     *     functionParameters: new ContractFunctionParameters().addUint256(42),
     *     withFunctionResult: true,
     * });
     * console.log(result.functionResult?.returnDataHex);
     * ```
     */
    async executeContract(options: ExecuteContractOptions) {
        return await this.executeOperation.execute(options);
    }

    /**
     * Relay a signed Ethereum transaction through Hedera
     * (`EthereumTransaction`, HIP-410), as JSON-RPC relays and wallets do.
     *
     * The Ethereum sender signs `ethereumData`; the Hedera payer (the
     * operator by default) submits it and covers up to `maxGasAllowance`
     * of gas the sender's gas price doesn't. Not schedulable.
     *
     * @param options.ethereumData - Signed RLP bytes, or a signed SDK `EthereumTransactionData`
     * @param options.callDataFileId - File with the call data, when it is too large for the transaction
     * @param options.maxGasAllowance - Most HBAR the payer covers for gas (default `0`)
     * @param options.withFunctionResult - Also fetch the EVM outcome (one extra paid query)
     * @returns The executor result, the receipt's `contractId` (the contract created or called), and `functionResult` when requested
     */
    async executeEthereumTransaction(
        options: ExecuteEthereumTransactionOptions,
    ) {
        return await this.ethereumOperation.execute(options);
    }

    /**
     * Schedule a contract execution for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the call executes automatically.
     *
     * @param options - Same fields as `executeContract`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleExecuteContract(
        options: ExecuteContractOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.executeOperation.schedule(options, scheduleOptions);
    }

    /**
     * Update mutable fields on an already-deployed contract.
     *
     * Only fields that are explicitly set are sent to the network; omitted
     * fields are left unchanged. The contract's current `adminKey` must
     * sign the transaction — pass it via `additionalSigners`. Contracts
     * deployed without an admin key are immutable and cannot be updated.
     *
     * Resolves once the consensus node returns a successful receipt;
     * per-update status / timing is delivered through the `before` /
     * `after` listener events on the surrounding `HieroContext`.
     *
     * @param options.contractId - Contract to update (required)
     * @param options.adminKey - Replace the current admin key
     * @param options.contractMemo - New contract memo (max 100 bytes)
     * @param options.autoRenewPeriod - New auto-renew period in seconds
     * @param options.autoRenewAccountId - Replace the auto-renew payer account
     * @param options.expirationTime - Extend the contract's expiration
     * @param options.bytecodeFileId - Replace the bytecode pointer (advanced)
     * @param options.stakedAccountId - Switch staking target (mutex with `stakedNodeId`)
     * @param options.stakedNodeId - Switch staking target (mutex with `stakedAccountId`)
     * @param options.declineStakingReward - Toggle staking-reward decline
     * @param options.maxAutomaticTokenAssociations - Update the auto-association limit (HIP-23 / HIP-904)
     * @param options.hooksToCreate - Hooks to add to the contract (HIP-1195)
     * @param options.hooksToDelete - IDs of the contract's hooks to delete (HIP-1195)
     *
     * @example
     * ```typescript
     * await contractService.updateContract({
     *     contractId: "0.0.12345",
     *     contractMemo: "renamed",
     *     additionalSigners: [adminKey],
     * });
     * ```
     */
    async updateContract(options: UpdateContractOptions) {
        return await this.updateOperation.execute(options);
    }

    /**
     * Schedule a contract update for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the update executes automatically.
     *
     * @param options - Same fields as `updateContract`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleUpdateContract(
        options: UpdateContractOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.updateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Permanently delete a contract and transfer its remaining HBAR balance
     * to a designated account or contract.
     *
     * The contract's `adminKey` must sign the transaction — pass it via
     * `additionalSigners`. Contracts deployed without an admin key are
     * immutable and cannot be deleted (network returns
     * `MODIFYING_IMMUTABLE_CONTRACT`).
     *
     * Exactly one of `transferAccountId` or `transferContractId` is
     * required. If the target account has `receiverSignatureRequired`
     * set, that account's key must also be passed via `additionalSigners`.
     *
     * After a successful delete every subsequent invocation of the contract
     * executes `0x0` (per EVM equivalence). The contract entity itself
     * remains in state until pruned by the network.
     *
     * Resolves once the consensus node returns a successful receipt;
     * per-delete status / timing is delivered through the `before` /
     * `after` listener events on the surrounding `HieroContext`.
     *
     * @param options.contractId - Contract to delete (required)
     * @param options.transferAccountId - Account that receives the remaining HBAR (mutex with `transferContractId`)
     * @param options.transferContractId - Contract that receives the remaining HBAR (mutex with `transferAccountId`)
     *
     * @example
     * ```typescript
     * await contractService.deleteContract({
     *     contractId: "0.0.12345",
     *     transferAccountId: "0.0.2",
     *     additionalSigners: [adminKey],
     * });
     * ```
     */
    async deleteContract(options: DeleteContractOptions) {
        return await this.deleteOperation.execute(options);
    }

    /**
     * Schedule a contract deletion for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the delete executes automatically.
     *
     * @param options - Same fields as `deleteContract`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleDeleteContract(
        options: DeleteContractOptions,
        scheduleOptions?: ScheduleOptions,
    ) {
        return await this.deleteOperation.schedule(options, scheduleOptions);
    }

    /**
     * Update the storage of an EVM hook (HIP-1195) owned by an account or a
     * contract. Lives here because `HookStore` is a smart contract service
     * transaction and covers both kinds of owner.
     *
     * The hook's admin key, if it has one, must sign; otherwise the
     * owner's key. Pass it via `additionalSigners`. Not schedulable.
     *
     * @param options.accountId - Account that owns the hook (mutex with `contractId`)
     * @param options.contractId - Contract that owns the hook (mutex with `accountId`)
     * @param options.hookId - The owner's hook ID
     * @param options.storageUpdates - `EvmHookStorageSlot` / `EvmHookMappingEntries` updates, at least one
     *
     * @example
     * ```typescript
     * await contractService.updateHookStorage({
     *     accountId: "0.0.1234",
     *     hookId: 1,
     *     storageUpdates: [
     *         new EvmHookStorageSlot({
     *             key: new Uint8Array([0x01]),
     *             value: new Uint8Array([0x2a]),
     *         }),
     *     ],
     *     additionalSigners: [ownerKey],
     * });
     * ```
     */
    async updateHookStorage(options: UpdateHookStorageOptions) {
        return await this.hookStoreOperation.execute(options);
    }

    /**
     * Invoke a view / pure contract function locally via
     * `ContractCallQuery`. The call executes on the queried node only —
     * no consensus round-trip and no gas is charged on success, so this
     * is the cheap path for reading on-chain state.
     *
     * Returns the SDK's `ContractFunctionResult` so callers can use the
     * typed decoders (`getUint256(0)`, `getString(0)`, `getAddress(0)`,
     * …) directly on the response.
     *
     * Exactly one call-target form must be supplied via
     * `CallContractOptions`: either `functionName` (with optional
     * `functionParameters`) or pre-encoded `rawFunctionParameters`.
     *
     * @param options.contractId - Contract to invoke
     * @param options.gas - Gas limit for the local call (required)
     * @param options.functionName - Function name to call; SDK encodes parameters
     * @param options.functionParameters - ABI-typed parameters (paired with `functionName`)
     * @param options.rawFunctionParameters - Pre-encoded ABI bytes (mutex with `functionName`)
     * @param options.senderAccountId - Account treated as `msg.sender` inside the call
     * @param options.maxResultSize - Cap on returned result bytes
     * @param options.queryPayment - Fixed query payment
     * @param options.maxQueryPayment - Cap on the SDK's estimated query payment
     *
     * @example
     * ```typescript
     * const result = await contractService.callContract({
     *     contractId: "0.0.12345",
     *     gas: 50_000,
     *     functionName: "get",
     * });
     * const value = result.getUint256(0);
     * ```
     */
    async callContract(
        options: CallContractOptions,
    ): Promise<ContractFunctionResult> {
        return await this.callQuery.execute(options);
    }

    /**
     * Simulate a contract call on the mirror node
     * (`MirrorNodeContractCallQuery`). Free and needs no gas limit, but
     * reads the mirror node's state, a few seconds behind consensus. Use
     * `callContract` to read from a consensus node.
     *
     * Listeners do not see this call: it never reaches a consensus node.
     *
     * @param options.contractId - Contract to call
     * @param options.functionName - Function name to call; SDK encodes parameters
     * @param options.functionParameters - ABI-typed parameters (paired with `functionName`)
     * @param options.rawFunctionParameters - Pre-encoded call data (mutex with `functionName`)
     * @param options.sender - Account used as `msg.sender`, as its long-zero address
     * @param options.senderEvmAddress - EVM address used as `msg.sender`, e.g. an ECDSA alias (mutex with `sender`)
     * @param options.value - Tinybars sent with the call
     * @param options.gasLimit - Gas limit for the simulation
     * @param options.gasPrice - Gas price in tinybars
     * @returns The call's return data as a `0x…` hex string
     * @throws {HieroError} `INPUT_INVALID` for a bad call target or call
     *   data over 131072 bytes; `SDK_ERROR` when the mirror node rejects
     *   the call, e.g. on a revert
     *
     * @example
     * ```typescript
     * const result = await contractService.simulateContractCall({
     *     contractId: "0.0.12345",
     *     functionName: "get",
     * });
     * const value = BigInt(result);
     * ```
     */
    async simulateContractCall(
        options: MirrorContractCallOptions,
    ): Promise<string> {
        return await this.mirrorQuery.call(options);
    }

    /**
     * Estimate the gas a contract call needs, on the mirror node
     * (`MirrorNodeContractEstimateQuery`), e.g. to pick the `gas` for
     * `executeContract`.
     *
     * Listeners do not see this call: it never reaches a consensus node.
     *
     * @param options - Same fields as `simulateContractCall`
     * @returns The estimated gas
     *
     * @example
     * ```typescript
     * const gas = await contractService.estimateContractGas({
     *     contractId: "0.0.12345",
     *     functionName: "set",
     *     functionParameters: new ContractFunctionParameters().addUint256(42),
     * });
     * ```
     */
    async estimateContractGas(
        options: MirrorContractCallOptions,
    ): Promise<number> {
        return await this.mirrorQuery.estimate(options);
    }

    /**
     * Fetch the on-chain `ContractInfo` for a deployed contract.
     *
     * Returns the SDK's `ContractInfo` directly: admin key, memo,
     * balance, expiration, auto-renew configuration, staking metadata,
     * token relationships, and `isDeleted` flag.
     *
     * @param contractId - Contract whose info to fetch
     * @param options - Optional query options (payer, payment caps, node targeting)
     */
    async getContractInfo(
        contractId: string | ContractId,
        options?: QueryOptions,
    ): Promise<ContractInfo> {
        return await this.infoQuery.execute(contractId, options);
    }

    /**
     * Fetch the deployed runtime bytecode for a contract as raw bytes
     * (not hex-encoded). Useful for proxy detection, implementation
     * comparison, or off-chain verification against a known source build.
     *
     * @param contractId - Contract whose bytecode to fetch
     * @param options - Optional query options (payer, payment caps, node targeting)
     */
    async getContractBytecode(
        contractId: string | ContractId,
        options?: QueryOptions,
    ): Promise<Uint8Array> {
        return await this.bytecodeQuery.execute(contractId, options);
    }
}
