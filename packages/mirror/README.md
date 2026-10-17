# @hiero-hackers/enterprise-mirror

A typed client for the Hiero mirror node REST API, with no dependencies.

Mirror node reads are free and need no keys, so this package has no SDK, no credentials and no gRPC. It only needs a global `fetch` (Node.js 18+). It covers the whole REST API with typed repositories, and adds pagination, client-side rate limiting, filters and unit helpers. To send transactions as well, add [`@hiero-hackers/enterprise-core`](../core).

## Install

```sh
npm install @hiero-hackers/enterprise-mirror
```

## Usage

```ts
import {
  MirrorNodeClient,
  TransactionRepository,
} from "@hiero-hackers/enterprise-mirror";

const mirror = new MirrorNodeClient("https://mainnet.mirrornode.hedera.com", {
  maxConcurrent: 25,
  maxRequestsPerSecond: 50,
});
const transactions = new TransactionRepository(mirror);

const recent = await transactions.findByAccount("0.0.98", {
  limit: 10,
  order: "desc",
});
```

Or read the settings from the environment (`HIERO_NETWORK`, `HIERO_MIRROR_NODE_*`):

```ts
import { createMirrorNodeClient } from "@hiero-hackers/enterprise-mirror";

const mirror = createMirrorNodeClient();
```

## Repositories

| Repository | Covers |
|---|---|
| `AccountRepository` | Accounts by ID or alias; current, past and network-wide balances; token holdings; staking rewards; pending airdrops; allowances; hooks |
| `BlockRepository` | Blocks by height, hash or time window |
| `ContractRepository` | Contracts, execution results, event logs, storage, call traces, opcode replays, and read-only `contracts/call` |
| `NftRepository` | NFTs by owner, token or serial, and each serial's transaction history |
| `TokenRepository` | Token metadata, now or in the past; token search; tokens held by an account; holder lists and snapshots |
| `TopicRepository` | Topic metadata (keys, HIP-991 fees) and messages by topic, sequence number or timestamp |
| `TransactionRepository` | Transactions, network-wide or by account, filtered by type and time |
| `NetworkRepository` | Exchange rates, supply, staking, node stake, registered nodes, the fee schedule and HIP-1313 fee estimates |
| `ScheduleRepository` | Scheduled transactions: signatures, executed or deleted state, expiry |

Together they cover every path and operation of the mirror node REST API: 47 of the 48 paths and 48 of the 49 operations in the vendored spec (v0.166). The missing one, `contracts/results/{id}/prestate`, is new upstream and no public network serves it yet. A test compares the client against the [spec](./spec) on every build, so the claim stays true. The mirror node's gRPC and Rosetta APIs are out of scope.

Create the repositories one by one, or all at once over one client. Either way they share its rate limiter:

```ts
import { createMirrorRepositories } from "@hiero-hackers/enterprise-mirror";

const { accountRepository, scheduleRepository } = createMirrorRepositories(mirror);
```

Many repositories show the results of core's writes: core sends airdrops and creates schedules, and these read them back.

```ts
// Airdrops waiting for this account to claim
const pending = await accountRepository.findPendingAirdrops("0.0.15");

// Accounts holding at least 1M ℏ on 14 May 2022
const snapshot = await accountRepository.listBalances({
  balance: { gte: 100_000_000_000_000 },
  timestamp: "1652531199.999999999",
});

// Has the scheduled transaction executed?
const schedule = await scheduleRepository.findById("0.0.777");
console.log(schedule.executedTimestamp, schedule.signatures.length);
```

## Contracts

`ContractRepository` reads what the EVM leaves behind and runs read-only calls. `contracts/call` is the API's only POST, but it is still free, needs no keys and goes through the same rate limiter:

```ts
import { ContractRepository } from "@hiero-hackers/enterprise-mirror";

const contracts = new ContractRepository(mirror);

// USDC decimals(), through the token's ERC-20 facade
const { result } = await contracts.call({
  to: "0x000000000000000000000000000000000006f89a",
  data: "0x313ce567",
});
console.log(parseInt(result, 16)); // 6

// Estimate gas for the same call
await contracts.call({ to, data, estimate: true });

// What an execution did: result, then its call frames
const details = await contracts.findResult("0xfebbaa…");
const frames = await contracts.findActions(details.hash);

// Event logs (topic filters need a time window of 7 days or less)
const transfers = await contracts.findLogs("0.0.5001", {
  topic0: "0xddf252ad…", // Transfer(address,address,uint256)
  timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
});
```

Amounts and gas are in tinybars. Addresses, call data, hashes, slots and topics are `0x` hex strings.

## Pagination

Every list method returns a `Page<T>`: its `data`, and a `next()` that fetches the following page. `collectAll` and `paginate` work with any page:

```ts
import { collectAll, paginate } from "@hiero-hackers/enterprise-mirror";

// Everything, capped so a huge result can't exhaust memory
const all = await collectAll(await nftRepository.findByOwner("0.0.12345"), {
  maxItems: 10_000,
});

// One page at a time
for await (const page of paginate(await topicRepository.findByTopicId("0.0.99"))) {
  for (const message of page) handle(message);
}

// Or by hand
let page = await transactionRepository.findByAccount("0.0.12345");
while (page.next) page = await page.next();
```

`collectAll` takes `{ maxItems, maxPages }`; leave both out to fetch everything. Every list method takes `{ limit, order }`. The mirror node caps `limit` (usually at 100), and `order` sorts by the endpoint's primary key.

Snapshot endpoints (`/balances`, `/tokens/{id}/balances`) also return the moment their figures describe, as `page.timestamp`.

### Previous pages

The mirror node only links forward, so `Page` can't go back. `KeysetPaginator` can: it fetches the previous page by querying before the current first row in reverse order. You give it a `load` function and a `keyOf` that returns the field you page by:

```ts
import { KeysetPaginator, TransactionRepository } from "@hiero-hackers/enterprise-mirror";

const transactions = new TransactionRepository(mirror);
const pager = new KeysetPaginator({
  order: "desc",
  limit: 25,
  keyOf: (t) => t.consensusTimestamp,
  load: (bound, order, limit) =>
    transactions
      .findByAccount("0.0.98", {
        order,
        limit,
        timestamp: bound ? { [bound.operator]: bound.key } : undefined,
      })
      .then((page) => page.data),
});

const first = await pager.first(); // newest 25
const older = await pager.next(); // the 25 before them
const back = await pager.previous(); // back to the first page
pager.hasPrevious; // false
```

`hasNext` and `hasPrevious` tell a table which arrows to enable. `first`, `next` and `previous` share one window, so await each call before the next.

## Filters

**Transactions** take a type, a time window and optionally an account. Leave out `accountId` to search the whole network:

```ts
const transfers = await transactionRepository.find({
  transactionType: "CRYPTOTRANSFER",
  timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
  limit: 100,
});
```

**Point in time**: read past state.

```ts
const then = await accountRepository.findByAccountId("0.0.98", {
  timestamp: "1700000000.000000000",
});
const supply = await networkRepository.findNetworkSupplies({
  timestamp: "1700000000.000000000",
});
const rate = await networkRepository.findExchangeRates({ timestamp });
const usdc = await tokenRepository.findById("0.0.456858", { timestamp });
```

**Fee estimates** (HIP-1313): send a transaction's protobuf bytes, for example from `transaction.toBytes()`, and get its fees in tinycents without submitting it:

```ts
const estimate = await networkRepository.estimateFees(transactionBytes);
console.log(estimate.total, estimate.node.base, estimate.service.base);
```

**ID lists**: ID filters take one ID, an array or a range. An array is sent as repeated parameters, and the mirror node returns all matches:

```ts
const trio = await accountRepository.list({
  accountId: ["0.0.98", "0.0.800", "0.0.801"],
});
```

**Balance thresholds**: account and token-holder lists filter by balance, in the smallest unit. `order` sorts by account ID, so sort by balance yourself:

```ts
const largeAccounts = await accountRepository.list({
  balance: { gte: 100_000_000_000 }, // 1,000 ℏ or more, in tinybars
});
const holders = await tokenRepository.findHolders("0.0.456858", {
  accountBalance: { gte: 1_000_000 }, // 1 USDC or more, at 6 decimals
});
```

## Rate limits

The client limits its own request rate, so large reads stay under the mirror node's limits instead of waiting out HTTP 429s:

| Option | Default | Does |
|---|---|---|
| `maxConcurrent` | `25` | Requests in flight at once; the rest wait. `Infinity` turns it off. |
| `maxRequestsPerSecond` | none | Sustained request rate, e.g. `50` |

Both work with the built-in retry, which honours `Retry-After`. Invalid values throw a `MirrorError` when the client is created. Set them per client, in `MirrorConfig`, or in the environment:

```sh
HIERO_MIRROR_NODE_MAX_CONCURRENT=25
HIERO_MIRROR_NODE_MAX_REQUESTS_PER_SECOND=50
HIERO_MIRROR_NODE_TIMEOUT_MS=10000
HIERO_MIRROR_NODE_MAX_RETRIES=3
HIERO_MIRROR_NODE_RETRY_ON_404=false
```

### New entities

A new entity can return HTTP 404 for a moment, between reaching consensus and being imported by the mirror node. To read one right after creating it, use `withRetryOn404()`. It retries the 404 with the same retry budget and backoff as a 429 or 5xx:

```ts
const account = await client.withRetryOn404().queryAccount(newAccountId);
```

The view shares the client's rate limiter, so it doesn't double your request rate. Other queries on the client still fail fast on a real 404.

`retryOn404: true` (or `HIERO_MIRROR_NODE_RETRY_ON_404=true`) does the same for every query on the client, so a lookup for something that doesn't exist costs `maxRetries + 1` requests. Use it only for a client that reads nothing but new entities. Either way, a 404 that lasts ends as `NOT_FOUND`.

## Request events

The client queues and retries internally, so callers only see a promise. An `observer` reports what happens underneath, for example to drive a loading spinner or a "retrying" banner:

```ts
const client = new MirrorNodeClient(url, {
  observer: {
    onRequestStart: () => spinner.increment(),
    onRetry: ({ status, delayMs }) =>
      banner.busy(`mirror node ${status ?? "timeout"}, retrying in ${delayMs}ms`),
    onRequestEnd: (e) => {
      spinner.decrement();
      if (e.errorCode && e.status !== 404) banner.error(e.errorCode);
    },
  },
});
```

Observers only receive data; they can't change, block or cancel a request.

- Every `onRequestStart` gets exactly one `onRequestEnd`, whatever the outcome.
- Retries call `onRetry` and don't start a new pair.
- An observer that throws never affects the request.
- The events cover the HTTP request only. A response that arrives but fails schema validation still ends as a success; `errorCode` is set only when the request itself failed.

`withRetryOn404()` reports through the same observer.

## Amounts

Every amount that can grow without limit is a decimal `string`: balances, transfers, fees, allowances, airdrops, staking figures and custom fees. Mainnet balances exceed `Number.MAX_SAFE_INTEGER` (2^53, about 90.07M ℏ in tinybars), and `JSON.parse` rounds such numbers silently. The client parses responses without that loss, so each string is exactly what the mirror node sent.

```ts
const balance = await client.queryAccountBalance("0.0.2");
BigInt(balance.tinybars) + 1n; // arithmetic
tinybarToHbar(balance.tinybars); // display
console.log(balance.tinybars); // logs and JSON work as is
```

| Amounts as… | Exact above 2^53 | `JSON.stringify`, logs | Arithmetic |
|---|---|---|---|
| `number` | ✗ rounds silently | ✓ | ✓ but wrong |
| `BigInt` | ✓ | ✗ throws | ✓ |
| `string` | ✓ | ✓ | `BigInt(x)` first |

Fields the protocol keeps small stay `number`: gas, counters and quotes the network computes. Fields that grow with holdings, or that users choose (hook IDs, custom-fee fractions, EIP-7702 nonces), are strings. `spec/diff-response-fields.mjs` checks this against the spec.

## Units and timestamps

```ts
import {
  formatUnits,
  fromConsensusTimestamp,
  hbarToTinybar,
  parseUnits,
  timestampRange,
  tinybarToHbar,
  toConsensusTimestamp,
} from "@hiero-hackers/enterprise-mirror";

hbarToTinybar(2.5); // "250000000"
parseUnits(2.5, 6); // "2500000", e.g. 2.5 USDC
toConsensusTimestamp(new Date()); // "1700000000.000000000" format

await transactionRepository.find({
  transactionType: "CRYPTOTRANSFER",
  timestamp: timestampRange({ from: dayStart, to: dayEnd }),
});
```

- `hbarToTinybar` and `parseUnits` return exact strings at any size: `parseUnits(2, 18)` is `"2000000000000000000"`.
- `tinybarToHbar` and `formatUnits` return a `number` for display. Above 2^53 smallest units they are approximate.
- `tinybarToHbarExact` and `formatUnitsExact` return an exact string instead: `formatUnitsExact("31869085891081369", 8)` is `"318690858.91081369"`. They are the exact inverse of `parseUnits`.

## Errors

Failures throw `MirrorError` with a `code`: `MIRROR_NODE_ERROR`, `MIRROR_NODE_HTTP_ERROR`, `MIRROR_NODE_SCHEMA_MISMATCH`, `MALFORMED_RESPONSE`, `TIMED_OUT`, `NOT_FOUND` or `CONFIG_INVALID`. It is a different class from core's `HieroError`, so `instanceof` tells you which package failed. HTTP failures also carry the `status`. A `MALFORMED_RESPONSE` with status 200 means the body wasn't JSON, typically a gateway's HTML error page.

A missing entity is a normal answer. An HTTP 404 or an empty result rejects with `NOT_FOUND`, and `orNull` turns exactly those into `null`:

```ts
import { orNull } from "@hiero-hackers/enterprise-mirror";

const account = await orNull(accounts.findAccount("0.0.98"));
if (account === null) {
  // doesn't exist, or the mirror node hasn't imported it yet
}
```

If the entity was just created, use [`withRetryOn404()`](#new-entities) instead.

## Examples

[`samples/examples/src/mirror`](../../samples/examples/src/mirror) runs against mainnet with no credentials. It shows query filters and the three ways to page through results.

## License

Apache-2.0 — see [LICENSE](../../LICENSE)
