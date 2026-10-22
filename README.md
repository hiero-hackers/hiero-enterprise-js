# Hiero Enterprise JS

[![CI](../../actions/workflows/build.yml/badge.svg)](../../actions/workflows/build.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Jexsie/4a3c4fd2dae12f95e6177ae3bc807403/raw/hiero-enterprise-js-coverage.json)](../../actions/workflows/build.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hiero-hackers/hiero-enterprise-js/badge)](https://scorecard.dev/viewer/?uri=github.com/hiero-hackers/hiero-enterprise-js)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

TypeScript libraries for building Node.js services on [Hiero](https://hiero.org) networks.

`@hiero-hackers/enterprise-core` sends transactions: accounts, tokens, topics, files, smart contracts and schedules, each behind a typed service. `@hiero-hackers/enterprise-mirror` reads the network's history from the mirror node, with no dependencies and no keys. Both wrap the plumbing a production service needs around the [Hiero SDK](https://github.com/hiero-ledger/hiero-sdk-js): a shared client, input checks, typed errors, pagination and rate limiting.

## Install

This repository publishes two packages. Both need Node.js 18 or later.

**Core**, to send transactions:

```sh
npm install @hiero-hackers/enterprise-core
```

**Mirror**, to read from the mirror node:

```sh
npm install @hiero-hackers/enterprise-mirror
```

Use them together or on their own.

## Usage

### Core

Writes need an operator account to sign and pay the fee. On testnet you can create one for free in the [Hedera Developer Portal](https://portal.hedera.com). Set it in the environment:

```sh
HIERO_NETWORK=testnet
HIERO_OPERATOR_ID=0.0.12345
HIERO_OPERATOR_KEY=<your private key>
HIERO_OPERATOR_KEY_TYPE=ecdsa   # or ed25519, or der
```

Create a topic and post a message to it:

```ts
import { HieroContext, TopicService } from "@hiero-hackers/enterprise-core";

const context = new HieroContext(); // reads the HIERO_* variables
const topics = new TopicService(context);

const { topicId } = await topics.createTopic({ topicMemo: "order events" });
const { sequenceNumber } = await topics.submitMessage({
  topicId,
  message: "order 42 shipped",
});

console.log(`message ${sequenceNumber} on topic ${topicId}`);
context.close();
```

```text
message 1 on topic 0.0.5005123
```

In a server, create the context and services once at startup and call `context.close()` on shutdown.

### Mirror

Reads need no account:

```ts
import {
  AccountRepository,
  createMirrorNodeClient,
  tinybarToHbarExact,
} from "@hiero-hackers/enterprise-mirror";

const mirror = createMirrorNodeClient({ network: "mainnet" });
const account = await new AccountRepository(mirror).findByAccountId("0.0.800");

console.log(`${account.accountId} holds ${tinybarToHbarExact(account.balance)} ℏ`);
```

```text
0.0.800 holds 133361877.79077463 ℏ
```

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/architecture-dark.svg">
  <img alt="Your application uses enterprise-core to send signed transactions to the consensus nodes over gRPC, and enterprise-mirror to read history from the mirror node over REST. The consensus nodes stream their records to the mirror node." src=".github/assets/architecture-light.svg">
</picture>

A Hiero network has two kinds of servers:

- **Consensus nodes** order and execute transactions. `enterprise-core` talks to them through the SDK. Every transaction is validated, built, signed by the operator, submitted, and returns its receipt.
- **Mirror nodes** store the history and serve it through a free REST API. `enterprise-mirror` is a typed client for that API.

## What It Does

**Core** — one service per part of the network:

| Service | Covers |
|---|---|
| `AccountService` | Accounts, HBAR / token / NFT transfers, allowances, balances, signature checks |
| `TokenService` | Fungible tokens and NFTs: create, mint, burn, freeze, pause, KYC, fees, airdrops |
| `TopicService` | Topics: create, update, delete, submit messages, subscribe |
| `FileService` | Files: create, append, update, delete, read |
| `ContractService` | Smart contracts: deploy, execute, update, delete, read-only calls, gas estimates, hook storage |
| `ScheduleService` | Scheduled transactions: sign, cancel, inspect |
| `NetworkService` | Transaction receipts and records, network version, atomic batches |

- Input is checked before sending. Bad input fails with `INPUT_INVALID` and costs no fee.
- Many write methods have a `schedule…` version, so several keys can sign the same transaction.
- Listeners get an event before and after every transaction and consensus node query, for logs and metrics.

**Mirror** — the whole mirror node REST API:

- Repositories for accounts, tokens, NFTs, topics, transactions, contracts, blocks, schedules and network state
- Every list returns a `Page` with `next()`; `collectAll` and `paginate` read all pages
- Client-side rate limiting and retries
- Large numbers keep their full precision
- Helpers for tinybar ⇄ ℏ, token decimals and consensus timestamps

The [core](./packages/core/README.md) and [mirror](./packages/mirror/README.md) READMEs list every export. [`samples/examples`](./samples/examples) has a runnable script for each service, and [`samples`](./samples) has Express, Fastify and NestJS apps.

## Errors

Core throws `HieroError` and mirror throws `MirrorError`. Both have a `code` you can check:

```ts
import {
  AccountService,
  HieroContext,
  HieroError,
  HieroErrorCodes,
} from "@hiero-hackers/enterprise-core";

const context = new HieroContext();
const accounts = new AccountService(context);

try {
  await accounts.transferHbar("0.0.1234", 5, context.operatorAccountId);
} catch (err) {
  if (err instanceof HieroError && err.code === HieroErrorCodes.InputInvalid) {
    // Rejected before sending; no fee was charged.
  }
  throw err;
}
```

## Limitations

- **Pre-1.0.** Minor releases can break the API.
- **Node.js only.** CI tests Node.js 22 and 24.
- **Not every SDK feature is wrapped.** Batch transactions, hooks and fee estimates are on the [roadmap](https://github.com/hiero-hackers/hiero-enterprise-js/milestones). Until then, `context.client` gives you the SDK client directly.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started, or open an [issue](https://github.com/hiero-hackers/hiero-enterprise-js/issues) to ask a question. Maintainers release with [RELEASE.md](./RELEASE.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE)
