import type { MirrorNodeClient } from "../../src/client/MirrorNodeClient.js";
import type {
    MirrorAccountInfo,
    Balance,
    Nft,
    Page,
    MirrorTokenInfo,
    MirrorTopicMessage,
    TransactionInfo,
    ExchangeRates,
    NetworkStake,
    NetworkSupplies,
    MirrorSchedule,
    MirrorTopicInfo,
    NetworkFees,
    Block,
    MirrorContractDetail,
    ContractResultDetails,
    OpcodeTrace,
    ContractCallResult,
    FeeEstimate,
} from "../../src/types/index.js";

/**
 * Create a no-op MirrorNodeClient mock for unit tests.
 * Each method returns a sensible empty/default value.
 */
export function createMockMirrorNodeClient(): MockMirrorNodeClient {
    return {
        queryAccount: () => Promise.resolve(accountInfo()),
        queryAccountBalance: () => Promise.resolve(balance()),
        queryAccounts: () => Promise.resolve(emptyPage()),
        queryAccountTokens: () => Promise.resolve(emptyPage()),
        queryTokenBalances: () => Promise.resolve(emptyPage()),
        queryTransactions: () => Promise.resolve(emptyPage()),
        queryNftsByAccount: () => Promise.resolve(emptyPage()),
        queryNftsByTokenId: () => Promise.resolve(emptyPage()),
        queryNftsByTokenIdAndSerial: () => Promise.resolve(nft()),
        queryNftsByAccountAndTokenId: () => Promise.resolve(emptyPage()),
        queryTokenById: () => Promise.resolve(tokenInfo()),
        queryTokensByAccountId: () => Promise.resolve(emptyPage()),
        queryTopicMessages: () => Promise.resolve(emptyPage()),
        queryTopicMessageBySequence: () => Promise.resolve(topicMessage()),
        queryTransactionsByAccount: () => Promise.resolve(emptyPage()),
        queryTransaction: () => Promise.resolve(transactionInfo()),
        queryExchangeRates: () => Promise.resolve(exchangeRates()),
        queryNetworkSupplies: () => Promise.resolve(networkSupplies()),
        queryNetworkStake: () => Promise.resolve(networkStake()),
        queryNetworkNodes: () => Promise.resolve(emptyPage()),
        queryBalances: () => Promise.resolve(emptyPage()),
        queryPendingAirdrops: () => Promise.resolve(emptyPage()),
        queryOutstandingAirdrops: () => Promise.resolve(emptyPage()),
        queryCryptoAllowances: () => Promise.resolve(emptyPage()),
        queryTokenAllowances: () => Promise.resolve(emptyPage()),
        queryNftAllowances: () => Promise.resolve(emptyPage()),
        querySchedules: () => Promise.resolve(emptyPage()),
        querySchedule: () => Promise.resolve(schedule()),
        queryTopic: () => Promise.resolve(topicInfo()),
        queryNetworkFees: () => Promise.resolve(networkFees()),
        queryNftTransactions: () => Promise.resolve(emptyPage()),
        queryTopicMessageByTimestamp: () => Promise.resolve(topicMessage()),
        queryBlocks: () => Promise.resolve(emptyPage()),
        queryBlock: () => Promise.resolve(block()),
        queryHooks: () => Promise.resolve(emptyPage()),
        queryHookStorage: () => Promise.resolve(emptyPage()),
        queryRegisteredNodes: () => Promise.resolve(emptyPage()),
        queryContracts: () => Promise.resolve(emptyPage()),
        queryContract: () => Promise.resolve(contractDetail()),
        queryContractResults: () => Promise.resolve(emptyPage()),
        queryAllContractResults: () => Promise.resolve(emptyPage()),
        queryContractResultByTimestamp: () =>
            Promise.resolve(contractResultDetails()),
        queryContractResult: () => Promise.resolve(contractResultDetails()),
        queryContractActions: () => Promise.resolve(emptyPage()),
        queryContractOpcodes: () => Promise.resolve(opcodeTrace()),
        queryContractState: () => Promise.resolve(emptyPage()),
        queryContractLogs: () => Promise.resolve(emptyPage()),
        queryAllContractLogs: () => Promise.resolve(emptyPage()),
        queryContractCall: () => Promise.resolve(contractCallResult()),
        queryTokens: () => Promise.resolve(emptyPage()),
        queryStakingRewards: () => Promise.resolve(emptyPage()),
        queryFeeEstimate: () => Promise.resolve(feeEstimate()),
        fetchNextPage: () => Promise.resolve(emptyPage()),
        get: () => Promise.reject(new Error("not mocked")),
    };
}

type MockMirrorNodeClient = {
    [K in keyof MirrorNodeClient]: MirrorNodeClient[K];
};

function emptyPage<T>(): Page<T> {
    return { data: [], links: { next: null }, next: null };
}

function accountInfo(): MirrorAccountInfo {
    return {
        accountId: "0.0.12345",
        balance: "100000000",
        deleted: false,
    };
}

function balance(): Balance {
    return {
        accountId: "0.0.12345",
        hbars: "100000000",
        tokens: [],
    };
}

function nft(): Nft {
    return {
        tokenId: "0.0.99999",
        serialNumber: 1,
        accountId: "0.0.12345",
        metadata: "",
        deleted: false,
    };
}

function tokenInfo(): MirrorTokenInfo {
    return {
        tokenId: "0.0.99999",
        name: "Test Token",
        symbol: "TST",
        type: "FUNGIBLE_COMMON",
        decimals: 2,
        totalSupply: "1000000",
        maxSupply: "0",
        treasuryAccountId: "0.0.12345",
        deleted: false,
        paused: false,
        customFees: [],
    };
}

function topicMessage(): MirrorTopicMessage {
    return {
        topicId: "0.0.88888",
        sequenceNumber: "1",
        message: "",
        runningHash: "",
        consensusTimestamp: "1234567890.000000000",
    };
}

function transactionInfo(): TransactionInfo {
    return {
        transactionId: "0.0.12345@1234567890.000000000",
        type: "CRYPTOTRANSFER",
        name: "cryptotransfer",
        result: "SUCCESS",
        consensusTimestamp: "1234567890.000000001",
        validStartTimestamp: "1234567890.000000000",
        successful: true,
        chargedTxFee: 100000,
        transfers: [],
        tokenTransfers: [],
        nftTransfers: [],
        stakingRewardTransfers: [],
    };
}

function exchangeRates(): ExchangeRates {
    return {
        currentRate: {
            hbarEquivalent: 30000,
            centEquivalent: 120000,
            expirationTime: "1234567890",
        },
        nextRate: {
            hbarEquivalent: 30000,
            centEquivalent: 120000,
            expirationTime: "1234567890",
        },
    };
}

function networkSupplies(): NetworkSupplies {
    return {
        releasedSupply: "5000000000000000000",
        totalSupply: "5000000000000000000",
        timestamp: "1234567890.000000000",
    };
}

function networkStake(): NetworkStake {
    return {
        maxStakeRewarded: "0",
        maxStakingRewardRatePerHbar: "0",
        maxTotalReward: "0",
        nodeRewardFeeFraction: 0,
        reservedStakingRewards: "0",
        rewardBalanceThreshold: "0",
        stakeTotal: "0",
        stakingPeriod: null,
        stakingPeriodDuration: 0,
        stakingPeriodsStored: 0,
        stakingRewardFeeFraction: 0,
        stakingRewardRate: "0",
        stakingStartThreshold: "0",
        unreservedStakingRewardBalance: "0",
    };
}

function schedule(): MirrorSchedule {
    return {
        consensusTimestamp: "1234567890.000000000",
        creatorAccountId: "0.0.1",
        deleted: false,
        executedTimestamp: null,
        expirationTime: null,
        memo: "",
        payerAccountId: "0.0.1",
        scheduleId: "0.0.777",
        signatures: [],
        transactionBody: "",
        waitForExpiry: false,
    };
}

function topicInfo(): MirrorTopicInfo {
    return {
        autoRenewAccount: null,
        autoRenewPeriod: null,
        createdTimestamp: null,
        deleted: false,
        memo: "",
        topicId: "0.0.88888",
    };
}

function networkFees(): NetworkFees {
    return { timestamp: "1234567890.000000000", fees: [] };
}

function block(): Block {
    return {
        count: 0,
        gasUsed: null,
        hapiVersion: null,
        hash: "0xabc",
        logsBloom: null,
        name: "test.rcd",
        number: 1,
        previousHash: "0xdef",
        size: null,
        timestamp: { from: "1.0", to: "2.0" },
    };
}

function contractDetail(): MirrorContractDetail {
    return {
        autoRenewAccount: null,
        autoRenewPeriod: null,
        contractId: "0.0.55555",
        createdTimestamp: null,
        deleted: false,
        evmAddress: "0x0000000000000000000000000000000000d903a7",
        expirationTimestamp: null,
        fileId: null,
        maxAutomaticTokenAssociations: null,
        memo: "",
        nonce: null,
        obtainerId: null,
        permanentRemoval: null,
        proxyAccountId: null,
        timestamp: { from: "1.0", to: null },
        bytecode: null,
        runtimeBytecode: null,
    };
}

function contractResultDetails(): ContractResultDetails {
    return {
        amount: null,
        blockGasUsed: null,
        blockHash: null,
        blockNumber: null,
        chainId: null,
        contractId: "0.0.55555",
        from: null,
        gasLimit: 100000,
        gasPrice: null,
        gasUsed: null,
        hash: "0xhash",
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        nonce: null,
        result: "SUCCESS",
        status: "0x1",
        timestamp: "1.0",
        to: null,
        transactionIndex: null,
        type: null,
        logs: [],
        stateChanges: [],
    };
}

function opcodeTrace(): OpcodeTrace {
    return {
        address: "0x0",
        contractId: "0.0.55555",
        failed: false,
        gas: 0,
        opcodes: [],
        returnValue: "0x",
    };
}

function contractCallResult(): ContractCallResult {
    return { result: "0x1" };
}

function feeEstimate(): FeeEstimate {
    return {
        highVolumeMultiplier: 1,
        network: { multiplier: 1, subtotal: 0 },
        node: { base: 0, extras: [] },
        service: { base: 0, extras: [] },
        total: 0,
    };
}
