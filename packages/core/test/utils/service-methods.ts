/**
 * One table of every public method of the core services. It drives
 * `test/unit/services/ServiceMethodEvents.test.ts` (listener events and
 * input validation against a mocked network) and
 * `test/integration/ServiceMethodErrors.spec.ts` (network rejections on
 * Solo). A public method without an entry fails the type check and the
 * coverage test.
 *
 * Each `call` names entities that don't exist (`MISSING_ID`,
 * `MISSING_ID_2`) or leaves out a signature: a mocked network accepts it,
 * a real one rejects it.
 */

import type { Client } from "@hiero-ledger/sdk";
import {
    AccountId,
    ContractFunctionParameters,
    CustomFixedFee,
    EvmHookStorageSlot,
    PendingAirdropId,
    PrivateKey,
    TokenId,
    TopicCreateTransaction,
    TransferTransaction,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../src/context/index.js";
import { HieroError } from "../../src/errors/index.js";
import {
    AccountService,
    ContractService,
    FileService,
    NetworkService,
    ScheduleService,
    TokenService,
    TopicService,
} from "../../src/services/index.js";
import { AccountType } from "../../src/types/index.js";

export const SERVICE_CLASSES = {
    AccountService,
    ContractService,
    FileService,
    NetworkService,
    ScheduleService,
    TokenService,
    TopicService,
};

export type ServiceName = keyof typeof SERVICE_CLASSES;

export type Services = {
    [S in ServiceName]: InstanceType<(typeof SERVICE_CLASSES)[S]>;
};

export function createServices(context: IHieroContext): Services {
    return {
        AccountService: new AccountService(context),
        ContractService: new ContractService(context),
        FileService: new FileService(context),
        NetworkService: new NetworkService(context),
        ScheduleService: new ScheduleService(context),
        TokenService: new TokenService(context),
        TopicService: new TopicService(context),
    };
}

/**
 * Prototype methods TypeScript marks `private`. They are on the prototype
 * at runtime but are not part of the public surface.
 */
export const PRIVATE_METHODS: Partial<Record<ServiceName, string[]>> = {
    TokenService: [
        "buildFungibleOperationOptions",
        "buildNftOperationOptions",
        "resolveSupplyType",
    ],
};

/** Entity IDs that exist on no network the suite runs against. */
export const MISSING_ID = "0.0.9999990";
export const MISSING_ID_2 = "0.0.9999991";

/** What a call needs from the context it runs in. */
export interface CallEnv {
    client: Client;
    operatorId: string;
}

/** A column with no case for this method, and why. */
export interface None {
    none: string;
}

/** The lifecycle events an executor path emits for one call. */
export interface MethodEvents {
    /** What is sent: a transaction, a paid query, or an SDK flow. */
    kind: "transaction" | "query" | "flow";
    /** Expected `event.type`. */
    type: string;
    /** Expected `event.methodName`. */
    methodName: string;
}

export interface MethodCase<S> {
    /**
     * The before/after events one call emits, or why it emits none (it
     * doesn't go through an executor).
     */
    events: MethodEvents | None;
    /**
     * A well-formed call: succeeds against a mocked network; on Solo,
     * when `reject` is `true`, the network rejects it.
     */
    call: (service: S, env: CallEnv) => unknown;
    /** Input core validation rejects with `INPUT_INVALID`. */
    invalid: ((service: S, env: CallEnv) => unknown) | None;
    /** `true` when Solo rejects `call`, or why no network rejection exists. */
    reject: true | None;
}

type PublicMethods<T> = {
    [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never;
}[keyof T];

export type ServiceMethodTable = {
    [S in ServiceName]: {
        [M in PublicMethods<Services[S]>]: MethodCase<Services[S]>;
    };
};

export function isNone(value: unknown): value is None {
    return typeof value === "object" && value !== null && "none" in value;
}

const tx = (type: string, methodName: string): MethodEvents => ({
    kind: "transaction",
    type,
    methodName,
});
const query = (type: string, methodName: string): MethodEvents => ({
    kind: "query",
    type,
    methodName,
});
const flow = (type: string, methodName: string): MethodEvents => ({
    kind: "flow",
    type,
    methodName,
});
const none = (reason: string): None => ({ none: reason });

const NOT_EXECUTOR = (what: string) =>
    none(`${what}, not an executor path: no listener events`);
const NO_CORE_VALIDATION = none(
    "core does not validate the input; the SDK parses it",
);
const NO_INPUT = none("takes no input");

/** A key no account on the network holds, so its signature is missing. */
export const UNKNOWN_KEY = PrivateKey.generateED25519();

/** Schedule options whose payer doesn't exist. */
const MISSING_PAYER = { payerAccountId: MISSING_ID };

/** A long-zero EVM address: never auto-created, resolves to no account. */
const LONG_ZERO_EVM_ADDRESS = `0x${"0".repeat(32)}0098967f`;

const createAccountOptions = (stakedAccountId?: string) => ({
    publicKey: UNKNOWN_KEY.publicKey.toString(),
    keyType: AccountType.ED25519,
    stakedAccountId,
});

const hookSlot = new EvmHookStorageSlot({
    key: new Uint8Array([0x01]),
    value: new Uint8Array([0x2a]),
});

const pendingAirdrop = (senderId: string, receiverId: string) =>
    new PendingAirdropId({
        senderId: AccountId.fromString(senderId),
        receiverId: AccountId.fromString(receiverId),
        tokenId: TokenId.fromString(MISSING_ID),
    });

export const SERVICE_METHODS: ServiceMethodTable = {
    AccountService: {
        createAccount: {
            events: tx("AccountCreate", "createAccount"),
            call: (s) => s.createAccount(createAccountOptions(MISSING_ID)),
            invalid: (s) =>
                s.createAccount({
                    ...createAccountOptions(),
                    initialBalance: -1,
                }),
            reject: true,
        },
        scheduleCreateAccount: {
            events: tx("AccountCreate", "createAccount"),
            call: (s) =>
                s.scheduleCreateAccount(createAccountOptions(), MISSING_PAYER),
            invalid: (s) =>
                s.scheduleCreateAccount({
                    ...createAccountOptions(),
                    initialBalance: -1,
                }),
            reject: true,
        },
        autoCreateEvmAccount: {
            events: tx("AccountAutoCreate", "autoCreateEvmAccount"),
            call: (s) =>
                s.autoCreateEvmAccount({
                    evmAddress: LONG_ZERO_EVM_ADDRESS,
                    amount: 1,
                }),
            invalid: (s) =>
                s.autoCreateEvmAccount({ evmAddress: "0x1234", amount: 1 }),
            reject: true,
        },
        scheduleAutoCreateEvmAccount: {
            events: tx("AccountAutoCreate", "autoCreateEvmAccount"),
            call: (s) =>
                s.scheduleAutoCreateEvmAccount(
                    { evmAddress: LONG_ZERO_EVM_ADDRESS, amount: 1 },
                    MISSING_PAYER,
                ),
            invalid: (s) =>
                s.scheduleAutoCreateEvmAccount({
                    evmAddress: "0x1234",
                    amount: 1,
                }),
            reject: true,
        },
        deleteAccount: {
            events: tx("AccountDelete", "deleteAccount"),
            call: (s) =>
                s.deleteAccount({
                    accountId: MISSING_ID,
                    accountKey: UNKNOWN_KEY,
                }),
            invalid: (s) =>
                s.deleteAccount({ accountId: "", accountKey: UNKNOWN_KEY }),
            reject: true,
        },
        scheduleDeleteAccount: {
            events: tx("AccountDelete", "deleteAccount"),
            call: (s) =>
                s.scheduleDeleteAccount(
                    { accountId: MISSING_ID },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleDeleteAccount({ accountId: "" }),
            reject: true,
        },
        updateAccount: {
            events: tx("AccountUpdate", "updateAccount"),
            call: (s) => s.updateAccount({ accountId: MISSING_ID, memo: "x" }),
            invalid: (s) => s.updateAccount({ accountId: "" }),
            reject: true,
        },
        scheduleUpdateAccount: {
            events: tx("AccountUpdate", "updateAccount"),
            call: (s) =>
                s.scheduleUpdateAccount(
                    { accountId: MISSING_ID, memo: "x" },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleUpdateAccount({ accountId: "" }),
            reject: true,
        },
        getAccountBalance: {
            events: NOT_EXECUTOR("Mirror node read"),
            call: (s) => s.getAccountBalance(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: NOT_EXECUTOR("Mirror node read"),
        },
        getAccountRecords: {
            events: query("AccountRecordsQuery", "getAccountRecords"),
            call: (s) => s.getAccountRecords(MISSING_ID),
            invalid: (s) => s.getAccountRecords("not-an-account"),
            reject: true,
        },
        getTokenBalance: {
            events: NOT_EXECUTOR("Mirror node read"),
            call: (s) => s.getTokenBalance(MISSING_ID, MISSING_ID_2),
            invalid: NO_CORE_VALIDATION,
            reject: NOT_EXECUTOR("Mirror node read"),
        },
        getOperatorAccountBalance: {
            events: NOT_EXECUTOR("Mirror node read"),
            call: (s) => s.getOperatorAccountBalance(),
            invalid: NO_INPUT,
            reject: NOT_EXECUTOR("Mirror node read"),
        },
        verifyAccountSignature: {
            events: query("AccountInfoQuery", "verifyAccountSignature"),
            call: (s) =>
                s.verifyAccountSignature(
                    MISSING_ID,
                    new Uint8Array([1]),
                    new Uint8Array(64),
                ),
            invalid: NO_CORE_VALIDATION,
            // The key check is local, but the key comes from an
            // AccountInfoQuery, which rejects an unknown account.
            reject: true,
        },
        verifyAccountTransaction: {
            events: query("AccountInfoQuery", "verifyAccountTransaction"),
            call: (s, env) =>
                s.verifyAccountTransaction(
                    MISSING_ID,
                    new TransferTransaction().freezeWith(env.client),
                ),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
        approveHbarAllowance: {
            events: tx("AccountAllowanceApprove", "approveHbarAllowance"),
            call: (s, env) =>
                s.approveHbarAllowance({
                    hbarAllowances: [
                        {
                            ownerAccountId: env.operatorId,
                            spenderAccountId: MISSING_ID,
                            amount: 1,
                        },
                    ],
                }),
            invalid: (s) => s.approveHbarAllowance({ hbarAllowances: [] }),
            reject: true,
        },
        approveTokenAllowance: {
            events: tx("AccountAllowanceApprove", "approveTokenAllowance"),
            call: (s, env) =>
                s.approveTokenAllowance({
                    tokenAllowances: [
                        {
                            tokenId: MISSING_ID,
                            ownerAccountId: env.operatorId,
                            spenderAccountId: MISSING_ID_2,
                            amount: 1,
                        },
                    ],
                }),
            invalid: (s) => s.approveTokenAllowance({ tokenAllowances: [] }),
            reject: true,
        },
        approveNftAllowance: {
            events: tx("AccountAllowanceApprove", "approveNftAllowance"),
            call: (s, env) =>
                s.approveNftAllowance({
                    nftAllowances: [
                        {
                            tokenId: MISSING_ID,
                            ownerAccountId: env.operatorId,
                            spenderAccountId: MISSING_ID_2,
                            serialNumbers: [1],
                        },
                    ],
                }),
            invalid: (s) => s.approveNftAllowance({ nftAllowances: [] }),
            reject: true,
        },
        deleteNftAllowance: {
            events: tx("AccountAllowanceDelete", "deleteNftAllowance"),
            call: (s, env) =>
                s.deleteNftAllowance([
                    {
                        tokenId: MISSING_ID,
                        ownerAccountId: env.operatorId,
                        serialNumbers: [1],
                    },
                ]),
            invalid: (s) => s.deleteNftAllowance([]),
            reject: true,
        },
        deleteAllNftAllowances: {
            events: tx("AccountAllowanceApprove", "deleteAllNftAllowances"),
            call: (s, env) =>
                s.deleteAllNftAllowances([
                    {
                        tokenId: MISSING_ID,
                        ownerAccountId: env.operatorId,
                        spenderAccountId: MISSING_ID_2,
                    },
                ]),
            invalid: (s) => s.deleteAllNftAllowances([]),
            reject: true,
        },
        deleteHbarAllowance: {
            events: tx("AccountAllowanceApprove", "deleteHbarAllowance"),
            call: (s) =>
                // The network accepts a zero allowance to an unknown
                // spender, so name an unknown owner instead.
                s.deleteHbarAllowance([
                    {
                        ownerAccountId: MISSING_ID,
                        spenderAccountId: MISSING_ID_2,
                    },
                ]),
            invalid: (s) => s.deleteHbarAllowance([]),
            reject: true,
        },
        deleteTokenAllowance: {
            events: tx("AccountAllowanceApprove", "deleteTokenAllowance"),
            call: (s, env) =>
                s.deleteTokenAllowance([
                    {
                        tokenId: MISSING_ID,
                        ownerAccountId: env.operatorId,
                        spenderAccountId: MISSING_ID_2,
                    },
                ]),
            invalid: (s) => s.deleteTokenAllowance([]),
            reject: true,
        },
        transferHbar: {
            events: tx("CryptoTransfer", "transferHbar"),
            call: (s, env) => s.transferHbar(MISSING_ID, 1, env.operatorId),
            invalid: (s, env) => s.transferHbar(MISSING_ID, 0, env.operatorId),
            reject: true,
        },
        scheduleTransferHbar: {
            events: tx("CryptoTransfer", "transferHbar"),
            call: (s, env) =>
                s.scheduleTransferHbar(
                    MISSING_ID_2,
                    1,
                    env.operatorId,
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleTransferHbar(MISSING_ID, 0, env.operatorId),
            reject: true,
        },
        transferToken: {
            events: tx("CryptoTransfer", "transferToken"),
            call: (s, env) =>
                s.transferToken(MISSING_ID, MISSING_ID_2, 1, env.operatorId),
            invalid: (s, env) =>
                s.transferToken(MISSING_ID, MISSING_ID_2, 0, env.operatorId),
            reject: true,
        },
        scheduleTransferToken: {
            events: tx("CryptoTransfer", "transferToken"),
            call: (s, env) =>
                s.scheduleTransferToken(
                    MISSING_ID,
                    MISSING_ID_2,
                    1,
                    env.operatorId,
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleTransferToken(
                    MISSING_ID,
                    MISSING_ID_2,
                    0,
                    env.operatorId,
                ),
            reject: true,
        },
        transferNft: {
            events: tx("CryptoTransfer", "transferNft"),
            call: (s, env) =>
                s.transferNft(MISSING_ID, 1, MISSING_ID_2, env.operatorId),
            invalid: (s, env) =>
                s.transferNft(MISSING_ID, 0, MISSING_ID_2, env.operatorId),
            reject: true,
        },
        scheduleTransferNft: {
            events: tx("CryptoTransfer", "transferNft"),
            call: (s, env) =>
                s.scheduleTransferNft(
                    MISSING_ID,
                    1,
                    MISSING_ID_2,
                    env.operatorId,
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleTransferNft(
                    MISSING_ID,
                    0,
                    MISSING_ID_2,
                    env.operatorId,
                ),
            reject: true,
        },
    },

    ContractService: {
        createContract: {
            events: tx("ContractCreate", "createContract"),
            call: (s) =>
                s.createContract({ bytecodeFileId: MISSING_ID, gas: 100_000 }),
            invalid: (s) => s.createContract({ gas: 100_000 }),
            reject: true,
        },
        scheduleCreateContract: {
            events: tx("ContractCreate", "createContract"),
            call: (s) =>
                s.scheduleCreateContract(
                    { bytecodeFileId: MISSING_ID, gas: 100_000 },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleCreateContract({ gas: 100_000 }),
            reject: true,
        },
        createContractFlow: {
            events: flow("ContractCreate", "createContractFlow"),
            call: (s) =>
                s.createContractFlow({
                    bytecode: "6080604052",
                    gas: 100_000,
                    stakedAccountId: MISSING_ID,
                }),
            invalid: (s) =>
                s.createContractFlow({ bytecode: "", gas: 100_000 }),
            reject: true,
        },
        executeContract: {
            events: tx("ContractExecute", "executeContract"),
            call: (s) =>
                // A call to an unknown contract succeeds as a call to an
                // empty address; gas below the intrinsic gas is rejected.
                s.executeContract({
                    contractId: MISSING_ID,
                    gas: 1,
                    functionName: "f",
                }),
            invalid: (s) =>
                s.executeContract({ contractId: MISSING_ID, gas: 100_000 }),
            reject: true,
        },
        executeEthereumTransaction: {
            events: tx("EthereumTransaction", "executeEthereumTransaction"),
            call: (s) =>
                s.executeEthereumTransaction({
                    ethereumData: new Uint8Array([1, 2, 3]),
                }),
            invalid: (s) =>
                s.executeEthereumTransaction({
                    ethereumData: new Uint8Array(),
                }),
            reject: true,
        },
        scheduleExecuteContract: {
            events: tx("ContractExecute", "executeContract"),
            call: (s) =>
                s.scheduleExecuteContract(
                    { contractId: MISSING_ID, gas: 100_000, functionName: "f" },
                    MISSING_PAYER,
                ),
            invalid: (s) =>
                s.scheduleExecuteContract({
                    contractId: MISSING_ID,
                    gas: 100_000,
                }),
            reject: true,
        },
        updateContract: {
            events: tx("ContractUpdate", "updateContract"),
            call: (s) =>
                s.updateContract({ contractId: MISSING_ID, contractMemo: "x" }),
            invalid: (s) => s.updateContract({ contractId: "" }),
            reject: true,
        },
        scheduleUpdateContract: {
            events: tx("ContractUpdate", "updateContract"),
            call: (s) =>
                s.scheduleUpdateContract(
                    { contractId: MISSING_ID, contractMemo: "x" },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleUpdateContract({ contractId: "" }),
            reject: true,
        },
        deleteContract: {
            events: tx("ContractDelete", "deleteContract"),
            call: (s, env) =>
                s.deleteContract({
                    contractId: MISSING_ID,
                    transferAccountId: env.operatorId,
                }),
            invalid: (s) => s.deleteContract({ contractId: "" }),
            reject: true,
        },
        scheduleDeleteContract: {
            events: tx("ContractDelete", "deleteContract"),
            call: (s, env) =>
                s.scheduleDeleteContract(
                    {
                        contractId: MISSING_ID,
                        transferAccountId: env.operatorId,
                    },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleDeleteContract({ contractId: "" }),
            reject: true,
        },
        updateHookStorage: {
            events: tx("HookStore", "updateHookStorage"),
            call: (s, env) =>
                s.updateHookStorage({
                    accountId: env.operatorId,
                    hookId: 1,
                    storageUpdates: [hookSlot],
                }),
            invalid: (s, env) =>
                s.updateHookStorage({
                    accountId: env.operatorId,
                    hookId: 1,
                    storageUpdates: [],
                }),
            reject: true,
        },
        callContract: {
            events: query("ContractCallQuery", "callContract"),
            call: (s) =>
                s.callContract({
                    contractId: MISSING_ID,
                    gas: 100_000,
                    functionName: "f",
                    functionParameters: new ContractFunctionParameters(),
                }),
            invalid: (s) =>
                s.callContract({ contractId: MISSING_ID, gas: 100_000 }),
            reject: true,
        },
        simulateContractCall: {
            events: NOT_EXECUTOR("Mirror node contract call"),
            call: (s) =>
                s.simulateContractCall({
                    contractId: MISSING_ID,
                    functionName: "f",
                }),
            invalid: (s) => s.simulateContractCall({ contractId: MISSING_ID }),
            reject: NOT_EXECUTOR("Mirror node contract call"),
        },
        estimateContractGas: {
            events: NOT_EXECUTOR("Mirror node gas estimate"),
            call: (s) =>
                s.estimateContractGas({
                    contractId: MISSING_ID,
                    functionName: "f",
                }),
            invalid: (s) => s.estimateContractGas({ contractId: MISSING_ID }),
            reject: NOT_EXECUTOR("Mirror node gas estimate"),
        },
        getContractInfo: {
            events: query("ContractInfoQuery", "getContractInfo"),
            call: (s) => s.getContractInfo(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
        getContractBytecode: {
            events: query("ContractByteCodeQuery", "getContractBytecode"),
            call: (s) => s.getContractBytecode(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
    },

    FileService: {
        createFile: {
            events: tx("FileCreate", "createFile"),
            // The file's keys must sign its creation.
            call: (s) =>
                s.createFile({
                    contents: "x",
                    keys: [UNKNOWN_KEY.publicKey],
                }),
            invalid: none("FileCreateValidator accepts every input"),
            reject: true,
        },
        appendToFile: {
            events: tx("FileAppend", "appendToFile"),
            call: (s) => s.appendToFile({ fileId: MISSING_ID, contents: "x" }),
            invalid: (s) => s.appendToFile({ fileId: "", contents: "x" }),
            reject: true,
        },
        updateFile: {
            events: tx("FileUpdate", "updateFile"),
            call: (s) => s.updateFile({ fileId: MISSING_ID, fileMemo: "x" }),
            invalid: (s) => s.updateFile({ fileId: "" }),
            reject: true,
        },
        scheduleUpdateFile: {
            events: tx("FileUpdate", "updateFile"),
            call: (s) =>
                s.scheduleUpdateFile(
                    { fileId: MISSING_ID, fileMemo: "x" },
                    MISSING_PAYER,
                ),
            invalid: (s) =>
                s.scheduleUpdateFile({
                    fileId: MISSING_ID,
                    contents: new Uint8Array(10_000),
                }),
            reject: true,
        },
        deleteFile: {
            events: tx("FileDelete", "deleteFile"),
            call: (s) => s.deleteFile({ fileId: MISSING_ID }),
            invalid: (s) => s.deleteFile({ fileId: "" }),
            reject: true,
        },
        getFileContents: {
            events: query("FileContentsQuery", "getFileContents"),
            call: (s) => s.getFileContents(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
        getFileInfo: {
            events: query("FileInfoQuery", "getFileInfo"),
            call: (s) => s.getFileInfo(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
    },

    NetworkService: {
        generateRandom: {
            events: tx("UtilPrng", "generateRandom"),
            call: (s) => s.generateRandom({ range: 10 }),
            invalid: (s) => s.generateRandom({ range: -1 }),
            reject: none(
                "names no entity and needs no signature beyond the payer's",
            ),
        },
        submitBatch: {
            events: tx("AtomicBatch", "submitBatch"),
            // The inner transaction's batch key doesn't sign the batch.
            call: async (s, env) =>
                s.submitBatch({
                    transactions: [
                        await new TopicCreateTransaction().batchify(
                            env.client,
                            UNKNOWN_KEY.publicKey,
                        ),
                    ],
                }),
            invalid: (s) => s.submitBatch({ transactions: [] }),
            reject: true,
        },
        getTransactionReceipt: {
            events: query("TransactionReceiptQuery", "getTransactionReceipt"),
            call: (s, env) =>
                s.getTransactionReceipt({
                    transactionId: `${env.operatorId}@1700000000.000000000`,
                }),
            invalid: (s) =>
                s.getTransactionReceipt({ transactionId: "not-a-tx-id" }),
            reject: none(
                "an unknown transaction id is answered RECEIPT_NOT_FOUND, which the SDK retries until it times out",
            ),
        },
        getTransactionRecord: {
            events: query("TransactionRecordQuery", "getTransactionRecord"),
            call: (s, env) =>
                s.getTransactionRecord({
                    transactionId: `${env.operatorId}@1700000000.000000000`,
                }),
            invalid: (s) =>
                s.getTransactionRecord({ transactionId: "not-a-tx-id" }),
            reject: none(
                "an unknown transaction id is answered RECORD_NOT_FOUND, which the SDK retries until it times out",
            ),
        },
        getNetworkVersionInfo: {
            events: query("NetworkVersionInfoQuery", "getNetworkVersionInfo"),
            call: (s) => s.getNetworkVersionInfo(),
            invalid: NO_INPUT,
            reject: none("names no entity; every node answers it"),
        },
        getAddressBook: {
            events: NOT_EXECUTOR("Mirror node gRPC stream"),
            call: (s) => s.getAddressBook(),
            invalid: (s) => s.getAddressBook({ limit: 0 }),
            reject: NOT_EXECUTOR("Mirror node gRPC stream"),
        },
        estimateFee: {
            events: NOT_EXECUTOR("Mirror node fee estimate"),
            call: (s, env) =>
                s.estimateFee(new TransferTransaction().freezeWith(env.client)),
            invalid: (s) => s.estimateFee(new TransferTransaction()),
            reject: NOT_EXECUTOR("Mirror node fee estimate"),
        },
    },

    ScheduleService: {
        sign: {
            events: tx("ScheduleSign", "sign"),
            call: (s) => s.sign({ scheduleId: MISSING_ID }),
            invalid: (s) => s.sign({ scheduleId: "" }),
            reject: true,
        },
        cancel: {
            events: tx("ScheduleDelete", "cancel"),
            call: (s) =>
                s.cancel({ scheduleId: MISSING_ID, adminKey: UNKNOWN_KEY }),
            invalid: (s) => s.cancel({ scheduleId: "", adminKey: UNKNOWN_KEY }),
            reject: true,
        },
        getInfo: {
            events: query("ScheduleInfoQuery", "getInfo"),
            call: (s) => s.getInfo(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
    },

    TokenService: {
        // Both token creators report the operation's name, "createToken",
        // which is not a public method.
        createFungibleToken: {
            events: tx("TokenCreate", "createToken"),
            call: (s) =>
                s.createFungibleToken({
                    tokenName: "T",
                    tokenSymbol: "T",
                    treasuryAccountId: MISSING_ID,
                }),
            invalid: (s, env) =>
                s.createFungibleToken({
                    tokenName: "",
                    tokenSymbol: "T",
                    treasuryAccountId: env.operatorId,
                }),
            reject: true,
        },
        scheduleCreateFungibleToken: {
            events: tx("TokenCreate", "createToken"),
            call: (s, env) =>
                s.scheduleCreateFungibleToken(
                    {
                        tokenName: "T",
                        tokenSymbol: "T",
                        treasuryAccountId: env.operatorId,
                    },
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleCreateFungibleToken({
                    tokenName: "",
                    tokenSymbol: "T",
                    treasuryAccountId: env.operatorId,
                }),
            reject: true,
        },
        createNft: {
            events: tx("TokenCreate", "createToken"),
            call: (s) =>
                s.createNft({
                    tokenName: "T",
                    tokenSymbol: "T",
                    treasuryAccountId: MISSING_ID,
                    supplyKey: UNKNOWN_KEY.publicKey,
                }),
            invalid: (s, env) =>
                s.createNft({
                    tokenName: "",
                    tokenSymbol: "T",
                    treasuryAccountId: env.operatorId,
                    supplyKey: UNKNOWN_KEY.publicKey,
                }),
            reject: true,
        },
        scheduleCreateNft: {
            events: tx("TokenCreate", "createToken"),
            call: (s, env) =>
                s.scheduleCreateNft(
                    {
                        tokenName: "T",
                        tokenSymbol: "T",
                        treasuryAccountId: env.operatorId,
                        supplyKey: UNKNOWN_KEY.publicKey,
                    },
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleCreateNft({
                    tokenName: "",
                    tokenSymbol: "T",
                    treasuryAccountId: env.operatorId,
                    supplyKey: UNKNOWN_KEY.publicKey,
                }),
            reject: true,
        },
        mintToken: {
            events: tx("TokenMint", "mintToken"),
            call: (s) => s.mintToken({ tokenId: MISSING_ID, amount: 1 }),
            invalid: (s) => s.mintToken({ tokenId: MISSING_ID }),
            reject: true,
        },
        scheduleMintToken: {
            events: tx("TokenMint", "mintToken"),
            call: (s) =>
                s.scheduleMintToken(
                    { tokenId: MISSING_ID, amount: 1 },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleMintToken({ tokenId: MISSING_ID }),
            reject: true,
        },
        burnToken: {
            events: tx("TokenBurn", "burnToken"),
            call: (s) => s.burnToken({ tokenId: MISSING_ID, amount: 1 }),
            invalid: (s) => s.burnToken({ tokenId: MISSING_ID }),
            reject: true,
        },
        scheduleBurnToken: {
            events: tx("TokenBurn", "burnToken"),
            call: (s) =>
                s.scheduleBurnToken(
                    { tokenId: MISSING_ID, amount: 1 },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleBurnToken({ tokenId: MISSING_ID }),
            reject: true,
        },
        wipeToken: {
            events: tx("TokenWipe", "wipeToken"),
            call: (s) =>
                s.wipeToken({
                    tokenId: MISSING_ID,
                    accountId: MISSING_ID_2,
                    amount: 1,
                }),
            invalid: (s) =>
                s.wipeToken({ tokenId: MISSING_ID, accountId: MISSING_ID_2 }),
            reject: true,
        },
        associateToken: {
            events: tx("TokenAssociate", "associateToken"),
            call: (s, env) =>
                s.associateToken({
                    accountId: env.operatorId,
                    tokenId: MISSING_ID,
                }),
            invalid: (s, env) =>
                s.associateToken({ accountId: env.operatorId, tokenId: "" }),
            reject: true,
        },
        scheduleAssociateToken: {
            events: tx("TokenAssociate", "associateToken"),
            call: (s, env) =>
                s.scheduleAssociateToken(
                    { accountId: env.operatorId, tokenId: MISSING_ID },
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleAssociateToken({
                    accountId: env.operatorId,
                    tokenId: "",
                }),
            reject: true,
        },
        dissociateToken: {
            events: tx("TokenDissociate", "dissociateToken"),
            call: (s, env) =>
                s.dissociateToken({
                    accountId: env.operatorId,
                    tokenIds: [MISSING_ID],
                }),
            invalid: (s, env) =>
                s.dissociateToken({ accountId: env.operatorId, tokenIds: [] }),
            reject: true,
        },
        scheduleDissociateToken: {
            events: tx("TokenDissociate", "dissociateToken"),
            call: (s, env) =>
                s.scheduleDissociateToken(
                    { accountId: env.operatorId, tokenIds: [MISSING_ID] },
                    MISSING_PAYER,
                ),
            invalid: (s, env) =>
                s.scheduleDissociateToken({
                    accountId: env.operatorId,
                    tokenIds: [],
                }),
            reject: true,
        },
        updateToken: {
            events: tx("TokenUpdate", "updateToken"),
            call: (s) => s.updateToken({ tokenId: MISSING_ID, tokenMemo: "x" }),
            invalid: (s) => s.updateToken({ tokenId: "" }),
            reject: true,
        },
        scheduleUpdateToken: {
            events: tx("TokenUpdate", "updateToken"),
            call: (s) =>
                s.scheduleUpdateToken(
                    { tokenId: MISSING_ID, tokenMemo: "x" },
                    MISSING_PAYER,
                ),
            invalid: (s) => s.scheduleUpdateToken({ tokenId: "" }),
            reject: true,
        },
        updateNfts: {
            events: tx("TokenUpdateNfts", "updateNfts"),
            call: (s) =>
                s.updateNfts({
                    tokenId: MISSING_ID,
                    serialNumbers: [1],
                    metadata: new Uint8Array([1]),
                }),
            invalid: (s) =>
                s.updateNfts({
                    tokenId: MISSING_ID,
                    serialNumbers: [],
                    metadata: new Uint8Array([1]),
                }),
            reject: true,
        },
        deleteToken: {
            events: tx("TokenDelete", "deleteToken"),
            call: (s) => s.deleteToken({ tokenId: MISSING_ID }),
            invalid: (s) => s.deleteToken({ tokenId: "" }),
            reject: true,
        },
        freezeToken: {
            events: tx("TokenFreeze", "freezeToken"),
            call: (s, env) =>
                s.freezeToken({
                    tokenId: MISSING_ID,
                    accountId: env.operatorId,
                }),
            invalid: (s, env) =>
                s.freezeToken({ tokenId: "", accountId: env.operatorId }),
            reject: true,
        },
        unfreezeToken: {
            events: tx("TokenUnfreeze", "unfreezeToken"),
            call: (s, env) =>
                s.unfreezeToken({
                    tokenId: MISSING_ID,
                    accountId: env.operatorId,
                }),
            invalid: (s, env) =>
                s.unfreezeToken({ tokenId: "", accountId: env.operatorId }),
            reject: true,
        },
        grantKycToken: {
            events: tx("TokenGrantKyc", "grantKycToken"),
            call: (s, env) =>
                s.grantKycToken({
                    tokenId: MISSING_ID,
                    accountId: env.operatorId,
                }),
            invalid: (s, env) =>
                s.grantKycToken({ tokenId: "", accountId: env.operatorId }),
            reject: true,
        },
        revokeKycToken: {
            events: tx("TokenRevokeKyc", "revokeKycToken"),
            call: (s, env) =>
                s.revokeKycToken({
                    tokenId: MISSING_ID,
                    accountId: env.operatorId,
                }),
            invalid: (s, env) =>
                s.revokeKycToken({ tokenId: "", accountId: env.operatorId }),
            reject: true,
        },
        pauseToken: {
            events: tx("TokenPause", "pauseToken"),
            call: (s) => s.pauseToken({ tokenId: MISSING_ID }),
            invalid: (s) => s.pauseToken({ tokenId: "" }),
            reject: true,
        },
        unpauseToken: {
            events: tx("TokenUnpause", "unpauseToken"),
            call: (s) => s.unpauseToken({ tokenId: MISSING_ID }),
            invalid: (s) => s.unpauseToken({ tokenId: "" }),
            reject: true,
        },
        updateTokenFeeSchedule: {
            events: tx("TokenFeeScheduleUpdate", "updateTokenFeeSchedule"),
            call: (s, env) =>
                s.updateTokenFeeSchedule({
                    tokenId: MISSING_ID,
                    customFees: [
                        new CustomFixedFee()
                            .setAmount(1)
                            .setFeeCollectorAccountId(env.operatorId),
                    ],
                }),
            invalid: (s) =>
                s.updateTokenFeeSchedule({ tokenId: "", customFees: [] }),
            reject: true,
        },
        airdropFungibleToken: {
            events: tx("TokenAirdrop", "airdropFungibleToken"),
            call: (s, env) =>
                s.airdropFungibleToken({
                    airdrops: [
                        {
                            tokenId: MISSING_ID,
                            senderAccountId: env.operatorId,
                            receiverAccountId: MISSING_ID_2,
                            amount: 1,
                        },
                    ],
                }),
            invalid: (s) => s.airdropFungibleToken({ airdrops: [] }),
            reject: true,
        },
        airdropNft: {
            events: tx("TokenAirdrop", "airdropNft"),
            call: (s, env) =>
                s.airdropNft({
                    airdrops: [
                        {
                            tokenId: MISSING_ID,
                            serial: 1,
                            senderAccountId: env.operatorId,
                            receiverAccountId: MISSING_ID_2,
                        },
                    ],
                }),
            invalid: (s) => s.airdropNft({ airdrops: [] }),
            reject: true,
        },
        claimAirdrop: {
            events: tx("TokenClaimAirdrop", "claimAirdrop"),
            call: (s, env) =>
                s.claimAirdrop({
                    pendingAirdropIds: [
                        pendingAirdrop(MISSING_ID_2, env.operatorId),
                    ],
                }),
            invalid: (s) => s.claimAirdrop({ pendingAirdropIds: [] }),
            reject: true,
        },
        cancelAirdrop: {
            events: tx("TokenCancelAirdrop", "cancelAirdrop"),
            call: (s, env) =>
                s.cancelAirdrop({
                    pendingAirdropIds: [
                        pendingAirdrop(env.operatorId, MISSING_ID_2),
                    ],
                }),
            invalid: (s) => s.cancelAirdrop({ pendingAirdropIds: [] }),
            reject: true,
        },
        rejectTokensFlow: {
            events: flow("TokenRejectFlow", "rejectTokensFlow"),
            call: (s, env) =>
                s.rejectTokensFlow({
                    ownerId: env.operatorId,
                    fungibleTokenIds: [MISSING_ID],
                }),
            invalid: (s, env) =>
                s.rejectTokensFlow({ ownerId: env.operatorId }),
            reject: true,
        },
        getTokenInfo: {
            events: query("TokenInfoQuery", "getTokenInfo"),
            call: (s) => s.getTokenInfo(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
        getNftInfo: {
            events: query("TokenNftInfoQuery", "getNftInfo"),
            call: (s) => s.getNftInfo(`${MISSING_ID}/1`),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
    },

    TopicService: {
        createTopic: {
            events: tx("TopicCreate", "createTopic"),
            // The auto-renew account must exist and sign.
            call: (s) => s.createTopic({ autoRenewAccountId: MISSING_ID }),
            invalid: none("TopicCreateValidator accepts every input"),
            reject: true,
        },
        scheduleCreateTopic: {
            events: tx("TopicCreate", "createTopic"),
            call: (s) => s.scheduleCreateTopic({}, MISSING_PAYER),
            invalid: none("TopicCreateValidator accepts every input"),
            reject: true,
        },
        updateTopic: {
            events: tx("TopicUpdate", "updateTopic"),
            call: (s) => s.updateTopic({ topicId: MISSING_ID, topicMemo: "x" }),
            invalid: (s) => s.updateTopic({ topicId: "" }),
            reject: true,
        },
        deleteTopic: {
            events: tx("TopicDelete", "deleteTopic"),
            call: (s) => s.deleteTopic({ topicId: MISSING_ID }),
            invalid: (s) => s.deleteTopic({ topicId: "" }),
            reject: true,
        },
        submitMessage: {
            events: tx("TopicMessageSubmit", "submitMessage"),
            call: (s) => s.submitMessage({ topicId: MISSING_ID, message: "x" }),
            invalid: (s) =>
                s.submitMessage({ topicId: MISSING_ID, message: "" }),
            reject: true,
        },
        getTopicInfo: {
            events: query("TopicInfoQuery", "getTopicInfo"),
            call: (s) => s.getTopicInfo(MISSING_ID),
            invalid: NO_CORE_VALIDATION,
            reject: true,
        },
        subscribeToMessages: {
            events: NOT_EXECUTOR("Mirror node subscription"),
            call: (s) =>
                s.subscribeToMessages({ topicId: MISSING_ID }, () => {}),
            invalid: NO_CORE_VALIDATION,
            reject: none(
                "a subscription reports failures to its errorHandler, not as a rejection",
            ),
        },
    },
};

/** One table row, flattened, with its calls bound to a service instance. */
export interface MethodEntry {
    service: ServiceName;
    method: string;
    events: MethodEvents | None;
    /** `true` when the row has an input core rejects with `INPUT_INVALID`. */
    hasInvalid: boolean;
    reject: true | None;
    call(services: Services, env: CallEnv): Promise<unknown>;
    callInvalid(services: Services, env: CallEnv): Promise<unknown>;
}

type LooseCall = (service: unknown, env: CallEnv) => unknown;

/** Every table row; a call's synchronous throw becomes a rejection. */
export const METHOD_ENTRIES: MethodEntry[] = Object.entries(
    SERVICE_METHODS,
).flatMap(([name, rows]) => {
    const service = name as ServiceName;
    const bind = (fn: LooseCall) => async (services: Services, env: CallEnv) =>
        await fn(new Map(Object.entries(services)).get(service), env);

    return Object.entries(rows as Record<string, MethodCase<unknown>>).map(
        ([method, row]) => ({
            service,
            method,
            events: row.events,
            hasInvalid: !isNone(row.invalid),
            reject: row.reject,
            call: bind(row.call as LooseCall),
            callInvalid: bind(
                isNone(row.invalid)
                    ? () => {
                          throw new Error(
                              `${service}.${method} has no invalid case`,
                          );
                      }
                    : (row.invalid as LooseCall),
            ),
        }),
    );
});

/** The SDK error under any HieroError wrapping. */
export function rootCause(error: unknown): unknown {
    return error instanceof HieroError ? rootCause(error.cause) : error;
}

/** Run a call and hand back what it threw. */
export async function rejectionOf(run: () => Promise<unknown>) {
    try {
        await run();
    } catch (error) {
        return error;
    }

    throw new Error("expected the call to throw");
}
