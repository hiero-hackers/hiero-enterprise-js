import type { EffectiveTimestampRange, MirrorKey } from "./common.js";

/**
 * Contract-family types (`/api/v1/contracts/**`) — the EVM read surface.
 * Hex-encoded values (addresses, call data, hashes, slots, topics) are
 * 0x-prefixed strings; amounts and gas values are in tinybars.
 */

/** A contract entity, from `/api/v1/contracts`. */
export interface MirrorContract {
    /** The contract's admin key, if readable */
    adminKey?: MirrorKey;
    /** Auto-renew payer account, if any */
    autoRenewAccount: string | null;
    /** Auto-renew period in seconds */
    autoRenewPeriod: number | null;
    /** The contract entity ID (`0.0.x`) */
    contractId: string;
    /** When the contract was created */
    createdTimestamp: string | null;
    /** Whether the contract has been deleted */
    deleted: boolean;
    /** The contract's 20-byte EVM address */
    evmAddress: string;
    /** When the contract expires */
    expirationTimestamp: string | null;
    /** The file holding the initcode, if created from a file */
    fileId: string | null;
    /** Max automatic token associations */
    maxAutomaticTokenAssociations: number | null;
    /** The contract memo */
    memo: string;
    /** The contract's nonce */
    nonce: number | null;
    /** The account to receive remaining balance on deletion */
    obtainerId: string | null;
    /** The proxy account the contract stakes through, if any (deprecated on-chain, still surfaced by the mirror node) */
    proxyAccountId: string | null;
    /** Whether the contract was removed by system expiry */
    permanentRemoval: boolean | null;
    /** Validity range; `to` is null while the entity is current */
    timestamp: EffectiveTimestampRange;
}

/** A single contract with bytecode, from `/api/v1/contracts/{id}`. */
export interface MirrorContractDetail extends MirrorContract {
    /** The hex encoded deployment (init) bytecode */
    bytecode: string | null;
    /** The hex encoded runtime bytecode */
    runtimeBytecode: string | null;
}

/**
 * The outcome of one contract function execution, from the contract
 * results listings.
 *
 * Nullability policy: fields the mirror node serializes on every result
 * row are `T | null` (null when they don't apply — e.g. the
 * ethereum-wrapped fields on a native HAPI call); fields the mirror node
 * omits entirely from some responses are optional (`?`). In particular,
 * LIST rows carry only a 15-field subset (verified live): the
 * block/ethereum-envelope fields and `result`/`status` arrive only on
 * per-result details, so they are optional here and re-required on
 * `ContractResultDetails`. On list rows, success is
 * `errorMessage == null`.
 */
export interface ContractResult {
    /** EIP-2930 access list of a wrapped ethereum transaction */
    accessList?: AccessListEntry[] | null;
    /** The contract's EVM address */
    address?: string;
    /** EIP-7702 authorizations of a wrapped ethereum transaction */
    authorizationList?: AuthorizationListEntry[] | null;
    /** Amount sent to the function, in tinybars */
    amount: number | null;
    /** Total gas used in the block (detail responses only) */
    blockGasUsed?: number | null;
    /** The block's hash (detail responses only) */
    blockHash?: string | null;
    /** The block height (detail responses only) */
    blockNumber?: number | null;
    /** Hex encoded bloom filter of the result */
    bloom?: string | null;
    /** Hex encoded value returned by the function */
    callResult?: string | null;
    /** Chain id of a wrapped ethereum transaction (detail responses only) */
    chainId?: string | null;
    /** The contract entity ID */
    contractId: string | null;
    /** Contracts created by this call */
    createdContractIds?: string[] | null;
    /** Error message when execution failed, e.g. "Out of gas" */
    errorMessage?: string | null;
    /** Hex encoded initcode of a failed contract create */
    failedInitcode?: string;
    /** EVM address of the caller */
    from: string | null;
    /** Hex encoded parameters passed to the function */
    functionParameters?: string | null;
    /** Gas actually consumed by the EVM */
    gasConsumed?: number | null;
    /** Gas limit for the execution */
    gasLimit: number;
    /** Gas price of a wrapped ethereum transaction (detail responses only) */
    gasPrice?: string | null;
    /** Gas charged for the execution */
    gasUsed: number | null;
    /** Transaction hash (populated for ethereum transactions) */
    hash: string;
    /** Max fee per gas of a wrapped ethereum tx (detail responses only) */
    maxFeePerGas?: string | null;
    /** Max priority fee per gas, ethereum tx (detail responses only) */
    maxPriorityFeePerGas?: string | null;
    /** Nonce of a wrapped ethereum transaction (detail responses only) */
    nonce?: number | null;
    /** Hex signature r of a wrapped ethereum transaction */
    r?: string | null;
    /** The transaction result, e.g. "SUCCESS" (detail responses only) */
    result?: string;
    /** Hex signature s of a wrapped ethereum transaction */
    s?: string | null;
    /** `0x1` on success, `0x0` otherwise (detail responses only) */
    status?: string;
    /** Consensus timestamp of the execution */
    timestamp: string;
    /** EVM address of the recipient */
    to: string | null;
    /** Position in the block (detail responses only) */
    transactionIndex?: number | null;
    /** Wrapped ethereum tx type, 0 pre-/2 post-EIP-1559 (detail only) */
    type?: number | null;
    /** Signature recovery id of a wrapped ethereum transaction */
    v?: number | null;
}

/** An EIP-2930 access-list entry on a wrapped ethereum transaction. */
export interface AccessListEntry {
    /** Hex address of the accessed contract */
    address: string;
    /** Hex storage keys accessed */
    storageKeys: string[];
}

/** An EIP-7702 authorization on a wrapped ethereum transaction. */
export interface AuthorizationListEntry {
    /** Hex address delegated to */
    address: string;
    /** Hex chain id */
    chainId: string;
    /** Authorization nonce */
    nonce: number;
    /** Hex signature r */
    r: string;
    /** Hex signature s */
    s: string;
    /** Hex y-parity of the signature point */
    yParity: string;
}

/** A log emitted during a contract result, without block context. */
export interface ContractLogEntry {
    /** The emitting contract's EVM address */
    address: string;
    /** Hex encoded bloom filter of the log */
    bloom?: string | null;
    /** The emitting contract's entity ID */
    contractId: string | null;
    /** The hex encoded log data */
    data: string | null;
    /** The log's index within the execution */
    index: number;
    /** Hex encoded topics of the log event */
    topics: string[];
}

/** A contract log with block/transaction context, from the log listings. */
export interface ContractLog extends ContractLogEntry {
    /** The block's hash */
    blockHash: string;
    /** The block height */
    blockNumber: number;
    /** The executed contract that created this log */
    rootContractId?: string | null;
    /** Consensus timestamp of the log */
    timestamp: string;
    /** Hex encoded transaction hash */
    transactionHash: string;
    /** Position of the transaction in the block */
    transactionIndex: number | null;
}

/** A storage slot change recorded by a contract execution. */
export interface ContractStateChange {
    /** The contract's EVM address */
    address: string;
    /** The contract entity ID */
    contractId: string | null;
    /** The hex encoded storage slot */
    slot: string;
    /** The hex encoded value read */
    valueRead: string;
    /** The hex encoded value written, or null if none */
    valueWritten: string | null;
}

/**
 * A contract result with execution detail — emitted logs and storage
 * changes — from `/api/v1/contracts/results/{transactionIdOrHash}` and
 * `/api/v1/contracts/{id}/results/{timestamp}`.
 */
export interface ContractResultDetails extends ContractResult {
    /** Total gas used in the block */
    blockGasUsed: number | null;
    /** The block's hash */
    blockHash: string | null;
    /** The block height */
    blockNumber: number | null;
    /** The hex encoded chain id of a wrapped ethereum transaction */
    chainId: string | null;
    /** Hex encoded gas price of a wrapped ethereum transaction */
    gasPrice: string | null;
    /** Max fee per gas of a wrapped ethereum transaction */
    maxFeePerGas: string | null;
    /** Max priority fee per gas of a wrapped ethereum transaction */
    maxPriorityFeePerGas: string | null;
    /** Nonce of a wrapped ethereum transaction */
    nonce: number | null;
    /** The transaction result, e.g. "SUCCESS" */
    result: string;
    /** `0x1` on success, `0x0` otherwise */
    status: string;
    /** Position of the transaction in the block */
    transactionIndex: number | null;
    /** Wrapped ethereum transaction type (0 pre-, 2 post-EIP-1559) */
    type: number | null;
    /** Logs emitted during the execution */
    logs: ContractLogEntry[];
    /** Storage slots read/written during the execution */
    stateChanges: ContractStateChange[];
}

/** One storage slot of a contract, from `/api/v1/contracts/{id}/state`. */
export interface ContractStateEntry {
    /** The contract's EVM address */
    address: string;
    /** The contract entity ID */
    contractId: string | null;
    /** Consensus timestamp of the state read */
    timestamp: string;
    /** The hex encoded storage slot */
    slot: string;
    /** The hex encoded value; `0x` implies no value written */
    value: string;
}

/**
 * One call frame of a contract execution, from
 * `/api/v1/contracts/results/{transactionIdOrHash}/actions`.
 */
export interface ContractAction {
    /** Nesting depth of the call */
    callDepth: number;
    /** EVM operation, e.g. CALL, DELEGATECALL, CREATE2 */
    callOperationType: string;
    /** Call category: CALL, CREATE, PRECOMPILE, SYSTEM, NO_ACTION */
    callType: string;
    /** The calling entity ID */
    caller: string | null;
    /** Whether the caller is an ACCOUNT or CONTRACT */
    callerType: string;
    /** EVM address of the caller */
    from: string;
    /** Gas provided for the frame, in tinybars */
    gas: number;
    /** Gas used by the frame, in tinybars */
    gasUsed: number;
    /** Position within the ordered action list */
    index: number;
    /** Hex encoded input data */
    input: string | null;
    /** The recipient entity ID */
    recipient: string | null;
    /** Whether the recipient is an ACCOUNT or CONTRACT */
    recipientType: string | null;
    /** Hex encoded result data */
    resultData: string | null;
    /** Meaning of `resultData`: OUTPUT, REVERT_REASON or ERROR */
    resultDataType: string;
    /** Consensus timestamp of the execution */
    timestamp: string;
    /** EVM address of the recipient */
    to: string | null;
    /** Value transferred, in tinybars */
    value: number;
}

/** One opcode step in a re-executed transaction trace. */
export interface Opcode {
    /** Current call depth */
    depth: number;
    /** Remaining gas */
    gas: number;
    /** Cost of executing the op */
    gasCost: number;
    /** EVM memory items in hex (null unless requested) */
    memory: string[] | null;
    /** The opcode mnemonic */
    op: string;
    /** The program counter */
    pc: number;
    /** The revert reason in hex, if the frame reverted */
    reason?: string | null;
    /** EVM stack items in hex (null unless requested) */
    stack: string[] | null;
    /** Storage slots read/written by the current contract (null unless requested) */
    storage: Record<string, string> | null;
}

/**
 * A full opcode trace from re-executing a transaction, from
 * `/api/v1/contracts/results/{transactionIdOrHash}/opcodes`.
 */
export interface OpcodeTrace {
    /** EVM address of the recipient (zero address for creates) */
    address: string;
    /** The contract entity ID */
    contractId: string | null;
    /** Whether the transaction failed to process completely */
    failed: boolean;
    /** Gas used, in tinybars */
    gas: number;
    /** The executed opcodes, in order */
    opcodes: Opcode[];
    /** The hex encoded return value */
    returnValue: string;
}

/**
 * Request body for `POST /api/v1/contracts/call` — cost-free execution of
 * read-only calls, gas estimation, or transient simulation of read-write
 * operations. Only `to` is required.
 */
export interface ContractCallRequest {
    /** Block to run against: hex/decimal number, "latest", "pending" or "earliest" (default "latest") */
    readonly block?: string;
    /** Hex encoded method signature + encoded parameters */
    readonly data?: string;
    /** When true, returns a gas estimate instead of executing (default false) */
    readonly estimate?: boolean;
    /** The 20-byte hex EVM address the call is sent from */
    readonly from?: string;
    /** Gas provided for the execution (default 15,000,000) */
    readonly gas?: number;
    /** Gas price used for each paid gas */
    readonly gasPrice?: number;
    /** The 20-byte hex EVM address the call is directed to */
    readonly to: string;
    /** Value sent with the call (default 0) */
    readonly value?: number;
}

/** Result of `POST /api/v1/contracts/call`. */
export interface ContractCallResult {
    /** Hex encoded result of the executed call (or the gas estimate) */
    result: string;
}
