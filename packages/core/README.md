# @hiero-hackers/enterprise-core

Typed services for sending transactions to a Hiero network.

Each service wraps a part of the [Hiero SDK](https://github.com/hiero-ledger/hiero-sdk-js): accounts, tokens, topics, files, smart contracts, schedules and network queries. Calls are checked before they are sent, signed by your operator account, and return plain objects. For reads from the mirror node, use [`@hiero-hackers/enterprise-mirror`](../mirror).

## Install

```sh
npm install @hiero-hackers/enterprise-core
```

## Usage

```ts
import {
  AccountService,
  AccountType,
  HieroContext,
  PrivateKey,
} from "@hiero-hackers/enterprise-core";

const context = new HieroContext({
  network: "testnet",
  operatorId: "0.0.12345",
  operatorKey: "<your private key>",
  operatorKeyType: "ed25519",
});

const accounts = new AccountService(context);
const key = PrivateKey.generateED25519();

const { accountId } = await accounts.createAccount({
  publicKey: key.publicKey.toStringRaw(),
  keyType: AccountType.ED25519,
  initialBalance: 10,
});

console.log(`created ${accountId}`);
context.close();
```

Every service takes the same `HieroContext`. It holds the SDK client and the operator account; `close()` releases the client's connections.

## Services

| Service | Covers |
|---|---|
| `AccountService` | Accounts, HBAR / token / NFT transfers, allowances, balances, signature checks |
| `TokenService` | Fungible tokens and NFTs: create, mint, burn, freeze, pause, KYC, fees, airdrops |
| `TopicService` | Topics: create, update, delete, submit messages, subscribe |
| `FileService` | Files: create, append, update, delete, read |
| `ContractService` | Smart contracts: deploy, execute, update, delete, read-only calls, mirror node call simulation and gas estimates, relayed Ethereum transactions, hook storage |
| `ScheduleService` | Scheduled transactions: sign, cancel, inspect |
| `NetworkService` | Transaction receipts and records, network version, pseudo-random numbers, node address book, fee estimates, atomic batches |

Many write methods have a `schedule…` version that returns a schedule ID instead of executing, so other keys can sign it later with `ScheduleService.sign`.

## Configuration

Pass a config object to `new HieroContext({ ... })`, or call it with no arguments to read the environment:

| Variable | Config field | Notes |
|---|---|---|
| `HIERO_NETWORK` | `network` | `mainnet`, `testnet`, `previewnet` or a custom name |
| `HIERO_OPERATOR_ID` | `operatorId` | The account that signs and pays |
| `HIERO_OPERATOR_KEY` | `operatorKey` | Its private key |
| `HIERO_OPERATOR_KEY_TYPE` | `operatorKeyType` | `ed25519`, `ecdsa` or `der`. Required: a raw key doesn't say which algorithm it uses |
| `HIERO_NETWORK_NODES` | `networkNodes` | Custom networks only |
| `HIERO_MIRROR_NETWORK` | `mirrorNetwork` | Custom networks only |
| `HIERO_MIRROR_NODE_URL` | `mirrorNodeUrl` | Custom networks only |
| `HIERO_REQUEST_TIMEOUT_MS` | `requestTimeoutMs` | Optional. Default 120000 |
| `HIERO_GRPC_DEADLINE_MS` | `grpcDeadlineMs` | Optional. Default 10000 |
| `HIERO_MAX_ATTEMPTS` | `maxAttempts` | Optional. Default 10 |
| `HIERO_MIN_BACKOFF_MS` | `minBackoffMs` | Optional. Default 250 |
| `HIERO_MAX_BACKOFF_MS` | `maxBackoffMs` | Optional. Default 8000 |

A numeric variable that is not a positive number throws a `CONFIG_INVALID` error. `context.config` is a copy with the key replaced by `"[redacted]"`, so it is safe to log.

## Balances

Balances come from the mirror node, because consensus nodes no longer answer balance queries:

```ts
const { tinybars } = await accounts.getAccountBalance("0.0.1234");
const { balance, decimals } = await accounts.getTokenBalance("0.0.1234", "0.0.5678");
```

A new account or transfer shows up a few seconds after it reaches consensus.

## Custom networks

For a network other than mainnet, testnet or previewnet, such as a local [Solo](https://github.com/hiero-ledger/solo) network, give it the consensus nodes and the mirror node:

```ts
const context = new HieroContext({
  network: "local",
  networkNodes: { "127.0.0.1:50211": "0.0.3" },
  mirrorNetwork: ["localhost:5600"],
  mirrorNodeUrl: "http://localhost:5551",
  operatorId: "0.0.2",
  operatorKey: "302e...",
  operatorKeyType: "der",
});
```

- `networkNodes`: the consensus nodes, as `"host:port": "accountId"`. In the environment: `HIERO_NETWORK_NODES="127.0.0.1:50211=0.0.3"`.
- `mirrorNetwork`: the mirror node's gRPC address, used for topic subscriptions and balances. In the environment: `HIERO_MIRROR_NETWORK="localhost:5600"`.
- `mirrorNodeUrl`: the mirror node's REST URL, which balances are read from. Without it the SDK uses port 5551 for a local mirror node; Solo serves REST on 38081. On a local mirror node, rest-java (8084) and web3 (8545) requests keep their own ports.

See [`custom-network.ts`](../../samples/examples/src/network/custom-network.ts).

## Errors

Every error is a `HieroError` with a `code`: `INPUT_INVALID`, `CONFIG_INVALID`, `NOT_FOUND`, `TIMED_OUT`, `SDK_ERROR`, `RESULT_MAPPING_FAILED` or `UNKNOWN`. Errors from a transaction also carry its `transactionId`; a failed `submitBatch` carries its `innerTransactionIds` too. See [Errors](../../README.md#errors) for an example.

## Examples

[`samples/examples`](../../samples/examples) has a runnable script for every service.

## License

Apache-2.0 — see [LICENSE](../../LICENSE)
