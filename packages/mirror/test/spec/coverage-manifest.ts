/**
 * The library's coverage of the vendored mirror node OpenAPI spec
 * (`packages/mirror/spec/openapi.yml` — source commit in spec/SNAPSHOT).
 *
 * Every operation in the spec must appear here; every query parameter
 * must be either `covered` (expressible through a query type) or
 * `omitted` — a documented, deliberate omission: the contract-result
 * `hbar` toggle (tinybars is the standard), topic-message `encoding`
 * (the `message` type is honest base64), and the embedded-transaction
 * sub-filters on the single-account endpoint (they shape a response
 * field the data model doesn't expose).
 *
 * The spec-coverage test diffs this manifest against the vendored spec
 * in both directions, so refreshing the snapshot after an upstream
 * change fails the build until coverage is consciously updated.
 */
export interface OperationCoverage {
    /** Query params expressible through the client's query types. */
    covered: string[];
    /** Spec params deliberately not exposed (documented decisions). */
    omitted?: string[];
}

export const SPEC_COVERAGE: Record<string, OperationCoverage> = {
    "GET /api/v1/accounts": {
        covered: [
            "account.balance",
            "account.id",
            "account.publickey",
            "balance",
            "limit",
            "order",
        ],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}": {
        covered: ["timestamp", "transactions"],
        omitted: ["limit", "order", "transactiontype"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/hooks": {
        covered: ["hook.id", "limit", "order"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/hooks/{hookId}/storage": {
        covered: ["key", "limit", "order", "timestamp"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/nfts": {
        covered: ["limit", "order", "serialnumber", "spender.id", "token.id"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/rewards": {
        covered: ["limit", "order", "timestamp"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/tokens": {
        covered: ["limit", "order", "token.id"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/airdrops/outstanding": {
        covered: ["limit", "order", "receiver.id", "serialnumber", "token.id"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/airdrops/pending": {
        covered: ["limit", "order", "sender.id", "serialnumber", "token.id"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/allowances/crypto": {
        covered: ["limit", "order", "spender.id"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/allowances/tokens": {
        covered: ["limit", "order", "spender.id", "token.id"],
    },
    "GET /api/v1/accounts/{idOrAliasOrEvmAddress}/allowances/nfts": {
        covered: ["account.id", "limit", "order", "owner", "token.id"],
    },
    "GET /api/v1/balances": {
        covered: [
            "account.balance",
            "account.id",
            "account.publickey",
            "limit",
            "order",
            "timestamp",
        ],
    },
    "GET /api/v1/blocks": {
        covered: ["block.number", "limit", "order", "timestamp"],
    },
    "GET /api/v1/blocks/{hashOrNumber}": {
        covered: [],
    },
    "POST /api/v1/contracts/call": {
        covered: [],
    },
    "GET /api/v1/contracts": {
        covered: ["contract.id", "limit", "order"],
    },
    "GET /api/v1/contracts/{contractIdOrAddress}": {
        covered: ["timestamp"],
    },
    "GET /api/v1/contracts/{contractIdOrAddress}/results": {
        covered: [
            "block.hash",
            "block.number",
            "from",
            "internal",
            "limit",
            "order",
            "timestamp",
            "transaction.index",
        ],
    },
    "GET /api/v1/contracts/{contractIdOrAddress}/state": {
        covered: ["limit", "order", "slot", "timestamp"],
    },
    "GET /api/v1/contracts/{contractIdOrAddress}/results/{timestamp}": {
        covered: [],
        omitted: ["hbar"],
    },
    "GET /api/v1/contracts/results": {
        covered: [
            "block.hash",
            "block.number",
            "from",
            "internal",
            "limit",
            "order",
            "timestamp",
            "transaction.index",
        ],
        omitted: ["hbar"],
    },
    "GET /api/v1/contracts/results/{transactionIdOrHash}": {
        covered: ["nonce"],
        omitted: ["hbar"],
    },
    "GET /api/v1/contracts/results/{transactionIdOrHash}/actions": {
        covered: ["index", "limit", "order"],
    },
    // Not implemented yet: upstream added it in 0.166.0-SNAPSHOT and no
    // public network serves it (mainnet/testnet 404, previewnet 501 as of
    // 2026-10-16).
    "GET /api/v1/contracts/results/{transactionIdOrHash}/prestate": {
        covered: [],
        omitted: ["Accept-Encoding", "code", "diff", "storage"],
    },
    "GET /api/v1/contracts/results/{transactionIdOrHash}/opcodes": {
        covered: ["memory", "stack", "storage"],
    },
    "GET /api/v1/contracts/{contractIdOrAddress}/results/logs": {
        covered: [
            "index",
            "limit",
            "order",
            "timestamp",
            "topic0",
            "topic1",
            "topic2",
            "topic3",
        ],
    },
    "GET /api/v1/contracts/results/logs": {
        covered: [
            "index",
            "limit",
            "order",
            "timestamp",
            "topic0",
            "topic1",
            "topic2",
            "topic3",
            "transaction.hash",
        ],
    },
    "GET /api/v1/network/exchangerate": {
        covered: ["timestamp"],
    },
    "GET /api/v1/network/fees": {
        covered: ["order", "timestamp"],
    },
    "POST /api/v1/network/fees": {
        covered: ["high_volume_throttle", "mode"],
    },
    "GET /api/v1/network/nodes": {
        covered: ["file.id", "limit", "node.id", "order"],
    },
    "GET /api/v1/network/registered-nodes": {
        covered: ["limit", "order", "registerednode.id", "type"],
    },
    "GET /api/v1/network/stake": {
        covered: [],
    },
    "GET /api/v1/network/supply": {
        covered: ["timestamp"],
    },
    "GET /api/v1/schedules": {
        covered: ["account.id", "limit", "order", "schedule.id"],
    },
    "GET /api/v1/schedules/{scheduleId}": {
        covered: [],
    },
    "GET /api/v1/transactions": {
        covered: [
            "account.id",
            "limit",
            "order",
            "result",
            "timestamp",
            "transactiontype",
            "type",
        ],
    },
    "GET /api/v1/transactions/{transactionId}": {
        covered: ["nonce", "scheduled"],
    },
    "GET /api/v1/topics/{topicId}": {
        covered: [],
    },
    "GET /api/v1/topics/{topicId}/messages": {
        covered: ["limit", "order", "sequencenumber", "timestamp"],
        omitted: ["encoding"],
    },
    "GET /api/v1/topics/{topicId}/messages/{sequenceNumber}": {
        covered: [],
    },
    "GET /api/v1/topics/messages/{timestamp}": {
        covered: [],
    },
    "GET /api/v1/tokens": {
        covered: [
            "account.id",
            "limit",
            "name",
            "order",
            "publickey",
            "token.id",
            "type",
        ],
    },
    "GET /api/v1/tokens/{tokenId}": {
        covered: ["timestamp"],
    },
    "GET /api/v1/tokens/{tokenId}/balances": {
        covered: [
            "account.balance",
            "account.id",
            "account.publickey",
            "limit",
            "order",
            "timestamp",
        ],
    },
    "GET /api/v1/tokens/{tokenId}/nfts": {
        covered: ["account.id", "limit", "order", "serialnumber"],
    },
    "GET /api/v1/tokens/{tokenId}/nfts/{serialNumber}": {
        covered: [],
    },
    "GET /api/v1/tokens/{tokenId}/nfts/{serialNumber}/transactions": {
        covered: ["limit", "order", "timestamp"],
    },
};
