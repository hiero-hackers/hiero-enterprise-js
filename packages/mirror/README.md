# @hiero-hackers/enterprise-mirror

Dependency-free client for the Hiero mirror node REST API — typed
repositories, continuable pagination, pro-active rate limiting, rich query
filters, and unit helpers.

Mirror node reads are free and keyless: no SDK, no operator credentials, no
gRPC. This package's only runtime requirement is global `fetch` (Node 18+).
If you also submit transactions, pair it with `@hiero-hackers/enterprise-core` or a
framework adapter.

```bash
npm install @hiero-hackers/enterprise-mirror
```

> **Note:** published to the GitHub Packages registry (not npmjs.org) — add
> `@hiero-hackers:registry=https://npm.pkg.github.com/` and a `read:packages`
> token to your `.npmrc` first; see
> [CONTRIBUTING § Installing the published packages](../../CONTRIBUTING.md#installing-the-published-packages).

```ts
import {
    MirrorNodeClient,
    TransactionRepository,
    collectAll,
} from "@hiero-hackers/enterprise-mirror";

const mirror = new MirrorNodeClient("https://mainnet.mirrornode.hedera.com", {
    maxConcurrent: 25,
    maxRequestsPerSecond: 50, // stay under 50 TPS
});
const transactions = new TransactionRepository(mirror);

const recent = await transactions.findByAccount("0.0.98", {
    limit: 10,
    order: "desc",
});
```

Or resolve everything from environment variables:

```ts
import { createMirrorNodeClient } from "@hiero-hackers/enterprise-mirror";
const mirror = createMirrorNodeClient(); // reads HIERO_NETWORK / HIERO_MIRROR_NODE_*
```

## Repositories

| Repository              | What it covers                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountRepository`     | Accounts by ID/alias, balances (current, point-in-time, or **network-wide historical snapshots**), per-token holdings, threshold scans, **staking-reward history**, pending/outstanding **airdrops**, live **allowances** (HBAR/token/NFT), account **hooks** |
| `BlockRepository`       | Blocks (record files) by height, hash, or time window                                                                                                                                                                                                         |
| `ContractRepository`    | The **EVM read surface** — contracts, execution results, event logs, storage, call traces, opcode-level replays, and read-only `contracts/call`                                                                                                               |
| `NftRepository`         | NFTs by owner, type, or serial — plus a serial's full **transaction history** (provenance)                                                                                                                                                                    |
| `TokenRepository`       | Token metadata (current or historical), **network-wide token search** (partial name match, type), tokens held by an account, holder threshold scans & **historical holder snapshots**                                                                         |
| `TopicRepository`       | Topic **metadata** (keys, HIP-991 fees) and messages by topic, sequence number, or consensus timestamp                                                                                                                                                        |
| `TransactionRepository` | Transactions network-wide or by account, filtered by type and time window                                                                                                                                                                                     |
| `NetworkRepository`     | Exchange rates (current or **historical**), supply, staking rewards, per-node stake, registered nodes, the **fee schedule**, and HIP-1313 **fee estimation**                                                                                                  |
| `ScheduleRepository`    | Scheduled transactions — signatures collected, executed/deleted state, expiry                                                                                                                                                                                 |

This covers the full mirror node REST API surface — all 47 paths and 48
operations of spec v0.159, parameter-complete. The claim is enforced, not
aspirational: the official OpenAPI spec is vendored under
[`spec/`](./spec) and a coverage test diffs it against the client on
every build. (The mirror node's gRPC subscription and Rosetta APIs are
separate protocols and out of scope.)

Construct repositories individually, or all of them over one shared
client (they draw from the same rate limiter either way):

```ts
import { createMirrorRepositories } from "@hiero-hackers/enterprise-mirror";
const { accountRepository, contractRepository } =
    createMirrorRepositories(mirror);
```

Several of these are the **read-side counterparts of core's write services**: core grants allowances, sends airdrops and creates schedules — this package is how you see them.

```ts
// What's waiting for this account to claim? (read-side of claimAirdrop)
const pending = await accountRepository.findPendingAirdrops("0.0.15");

// Historical distribution: accounts holding ≥ 1M ℏ on 14 May 2022
const snapshot = await accountRepository.listBalances({
    balance: { gte: 100_000_000_000_000 },
    timestamp: "1652531199.999999999",
});

// Has my scheduled transaction executed yet?
const schedule = await scheduleRepository.findById("0.0.777");
console.log(schedule.executedTimestamp, schedule.signatures.length);
```

## Contracts & EVM

`ContractRepository` reads everything the EVM leaves behind — and can
execute read-only calls. `contracts/call` is the API's one POST, but it is
still free, keyless, and goes through the same rate gate:

```ts
import { ContractRepository } from "@hiero-hackers/enterprise-mirror";
const contracts = new ContractRepository(mirror);

// ERC-20 read via the HTS facade: USDC decimals()
const { result } = await contracts.call({
    to: "0x000000000000000000000000000000000006f89a",
    data: "0x313ce567",
});
console.log(parseInt(result, 16)); // 6

// Or estimate gas for the same call:
await contracts.call({ to, data, estimate: true });

// What did an execution do? Result → logs/state changes → call frames:
const details = await contracts.findResult("0xfebbaa…");
const frames = await contracts.findActions(details.hash);

// Event-log search (topic filters need a timestamp window ≤ 7 days):
const transfers = await contracts.findLogs("0.0.5001", {
    topic0: "0xddf252ad…", // Transfer(address,address,uint256)
    timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
});
```

Amounts and gas values are in tinybars; addresses, call data, hashes,
slots and topics are 0x-prefixed hex strings.

## Pagination

Every list method returns a **continuable `Page<T>`** — `data` plus a bound
`next()` that fetches the following page with no path or converter to
re-declare. Two generic helpers, `collectAll` and `paginate`, drive any
page, so you never hand-roll a `while (links.next)` loop:

```ts
import { collectAll, paginate } from "@hiero-hackers/enterprise-mirror";

// Collect everything, bounded so a surprise-huge result can't blow up memory:
const all = await collectAll(await nftRepository.findByOwner("0.0.12345"), {
    maxItems: 10_000,
});

// Or stream page by page (memory-friendly for huge listings):
for await (const page of paginate(
    await topicRepository.findByTopicId("0.0.99"),
)) {
    for (const message of page) process(message);
}

// Or step manually:
let page = await transactionRepository.findByAccount("0.0.12345");
while (page.next) page = await page.next();
```

`collectAll` accepts `{ maxItems, maxPages }` — omit both to fetch the
entire set. Each page fetch runs through the rate limiter below.

Snapshot endpoints (`/balances`, `/tokens/{id}/balances`) also report the
consensus moment their figures describe — it's carried through as
`page.timestamp`.

### Bidirectional (prev/next) pagination

`Page.next()` walks the mirror node's `links.next` forward — perfect for a
drain, but the mirror node emits **no `links.prev`**, so it can't step an
interactive table _backward_. `KeysetPaginator` closes that: it reconstructs
the missing direction with keyset (cursor) pagination — for a previous page it
queries strictly before the current first row in the inverted order and
reverses the result — over the same repository methods and `RangeFilter`
params. You supply a one-line `load` adapter (bound → keyset param) and a
`keyOf` (item → that same field); the paginator owns the operator/order
algebra.

```ts
import {
    TransactionRepository,
    KeysetPaginator,
} from "@hiero-hackers/enterprise-mirror";

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
const older = await pager.next(); // next 25, older
const back = await pager.previous(); // ← back to `first`
pager.hasPrevious; // false — we're on page one again
```

`hasNext` / `hasPrevious` gate the table's arrows; `first`/`next`/`previous`
mutate one shared window, so await each before the next.

**Page size & ordering.** Every list method takes `{ limit, order }`. The
mirror node caps `limit` (typically at 100) and `order` sorts by the
endpoint's primary key — both are preserved across `links.next`.

## Filtering

**Transactions** take a bundled query — type, consensus-timestamp window,
optionally an account, plus page controls. Omit `accountId` to search
network-wide:

```ts
const transfers = await transactionRepository.find({
    transactionType: "CRYPTOTRANSFER",
    timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
    limit: 100,
});
```

**Point-in-time reads** — historical state for time-series analysis:

```ts
const then = await accountRepository.findByAccountId("0.0.98", {
    timestamp: "1700000000.000000000",
});
const supply = await networkRepository.findNetworkSupplies({
    timestamp: "1700000000.000000000",
});
// Historical HBAR/cent price, token supply, and holder snapshots too:
const rate = await networkRepository.findExchangeRates({ timestamp });
const usdc = await tokenRepository.findById("0.0.456858", { timestamp });
```

**Fee estimation** (HIP-1313) — POST the protobuf-encoded transaction
bytes (e.g. from core's `transaction.toBytes()`), get a node/network/
service breakdown in tinycents without submitting:

```ts
const estimate = await networkRepository.estimateFees(transactionBytes);
console.log(estimate.total, estimate.node.base, estimate.service.base);
```

**Discrete ID lists** — entity-ID filters accept a single ID, an array
(sent as repeated params; the mirror node returns the union), or a range:

```ts
// One request, three specific accounts:
const trio = await accountRepository.list({
    accountId: ["0.0.98", "0.0.800", "0.0.801"],
});
```

**Balance thresholds** — greater/less-than filters on the account and
token-holder listings (amounts in the smallest unit; rank by balance
client-side, since `order` sorts by account ID):

```ts
const largeAccounts = await accountRepository.list({
    balance: { gte: 100_000_000_000 }, // ≥ 1,000 ℏ, in tinybars
});
const holders = await tokenRepository.findHolders("0.0.456858", {
    accountBalance: { gte: 1_000_000 }, // ≥ 1 USDC at 6 decimals
});
```

## Rate limiting & concurrency

The client throttles **pro-actively** instead of only backing off after an
HTTP 429 — essential when draining large result sets:

| Option                 | Default     | What it does                                                                   |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| `maxConcurrent`        | `25`        | Maximum requests in flight at once; extra requests queue. `Infinity` disables. |
| `maxRequestsPerSecond` | _unlimited_ | Ceiling on sustained request rate (e.g. `50` stays under 50 TPS).              |

Both compose with the built-in `Retry-After`-aware retry. Invalid values
throw a `MirrorError` at construction. Configure per client, via
`MirrorConfig`, or via environment:

```bash
HIERO_MIRROR_NODE_MAX_CONCURRENT=25
HIERO_MIRROR_NODE_MAX_REQUESTS_PER_SECOND=50
HIERO_MIRROR_NODE_TIMEOUT_MS=10000
HIERO_MIRROR_NODE_MAX_RETRIES=3
HIERO_MIRROR_NODE_RETRY_ON_404=false
```

### Retrying freshly-created entities (`retryOn404`)

Mirror nodes are eventually consistent: an entity can briefly return
**HTTP 404** in the short window between its creating transaction reaching
consensus and the mirror node importing it. When you query an entity right
after creating it, retry the 404 on the same `maxRetries` budget and backoff
as 429/5xx instead of failing immediately.

Prefer the per-call `withRetryOn404()` view, so only the just-created lookup
pays the extra retries — every other query on the client keeps failing fast
on a genuine 404:

```ts
const account = await client.withRetryOn404().queryAccount(newAccountId);
```

The view shares the base client's concurrency + rate gate, so the pair
counts against a single budget rather than doubling your effective request
rate against the node.

A client-wide `retryOn404: true` option (or `HIERO_MIRROR_NODE_RETRY_ON_404=true`)
also exists, but it applies to **every** query — including genuine
"no such entity" lookups, which then cost `maxRetries + 1` requests each
before resolving. Reach for it only when a client exclusively reads
freshly-created entities; otherwise use the view.

Retry-on-404 defaults to **off** because a 404 is normally a legitimate "no
such entity". Either way, a persistent 404 exhausts the retries and still
surfaces as `NOT_FOUND` — so `orNull` keeps treating genuine absence as
`null` (see [Errors](#errors)).

## Request telemetry (observer)

The client owns queueing and retries internally, so a caller sees only a
promise that eventually settles. An optional **observer** restores
visibility for UIs — a loading indicator counts balanced start/end pairs
(queue time included), a status banner distinguishes "busy, retrying" from
a terminal failure.

**This is read-only telemetry, not middleware** — observers receive plain
data and cannot mutate, intercept, or cancel requests. Guarantees: one
`onRequestEnd` per `onRequestStart` on every transport outcome (success,
HTTP error, timeout, unreadable body); retries surface via `onRetry`
without producing extra pairs; callbacks are error-isolated — an observer
bug never affects the request. The bracket covers the *transport*: schema
validation runs after it, so a payload that arrives but fails validation
ends as a transport success — `errorCode` present means the wire request
itself failed. The `withRetryOn404()` view reports through the same
observer.

```ts
const client = new MirrorNodeClient(url, {
  observer: {
    onRequestStart: () => spinner.increment(),
    onRetry: ({ status, delayMs }) =>
      banner.busy(`mirror node ${status ?? 'timeout'}, retrying in ${delayMs}ms`),
    onRequestEnd: (e) => {
      spinner.decrement();
      if (e.errorCode && e.status !== 404) banner.error(e.errorCode);
    },
  },
});
```

## Amounts are strings

Every **unbounded** tinybar and token-amount field on the public types is a
decimal `string`, not a `number` — balances, transfer legs, fees, allowances,
airdrops, staking figures, custom-fee amounts. This is a correctness
requirement, not a style choice: live mainnet balances exceed
`Number.MAX_SAFE_INTEGER` (2^53 ≈ 90.07M ℏ in tinybars), and `JSON.parse`
silently rounds such values. The client parses responses losslessly
(`utils/LosslessJson.ts`), so the strings are digit-exact copies of what the
mirror node sent.

```ts
const balance = await client.getAccountBalance("0.0.2");
BigInt(balance.tinybars) + 1n;        // arithmetic: one wrapper call
tinybarToHbar(balance.tinybars);      // display: unit helpers below
console.log(balance.tinybars);        // logs, JSON, React — just works
```

Why `string` and not the alternatives:

| amounts as… | exact above 2^53 | `JSON.stringify`, logs | arithmetic |
| --- | --- | --- | --- |
| `number` | ✗ silently rounds | ✓ | ✓ but wrong |
| `BigInt` | ✓ | ✗ throws `TypeError` | ✓ |
| `string` | ✓ | ✓ | `BigInt(x)` first |

Fields that are structurally bounded far below 2^53 stay `number` (gas
values, counters, network-computed quotes). If a field can grow with a
user's holdings — or is user-chosen, like hook ids, custom-fee fraction
numerators/denominators, and EIP-7702 authorization nonces, where any
int64 is legitimate data — it is a string; if the protocol bounds it, it
is a number. The line is machine-enforced against the vendored OpenAPI
spec by `spec/diff-response-fields.mjs`.

## Unit & timestamp helpers

```ts
import {
    tinybarToHbar,
    hbarToTinybar, // 250_000_000 ⇄ 2.5 ℏ
    formatUnits,
    parseUnits, // "2500000" @ 6 decimals ⇄ 2.5 USDC
    toConsensusTimestamp,
    fromConsensusTimestamp, // Date/ms ⇄ "seconds.nanoseconds"
    timestampRange, // { from, to } dates → { gte, lt } window
} from "@hiero-hackers/enterprise-mirror";

await transactionRepository.find({
    transactionType: "CRYPTOTRANSFER",
    timestamp: timestampRange({ from: dayStart, to: dayEnd }),
});
```

The builder direction (`hbarToTinybar`, `parseUnits`) returns exact decimal
strings at any magnitude — `parseUnits(2, 18)` is `"2000000000000000000"`,
which `number` math cannot even represent — so the outputs compose with the
string amount fields and query thresholds. The display direction
(`tinybarToHbar`, `formatUnits`) returns `number` and is approximate above
2^53 smallest units: fine for rendering, not for arithmetic.

For values past that point — the whale balances the lossless parse exists
for — the `-Exact` variants (`tinybarToHbarExact`, `formatUnitsExact`)
return the display value as a digit-exact decimal string instead:
`formatUnitsExact("31869085891081369", 8)` is `"318690858.91081369"`,
where the `number` helper has already rounded. They are the exact inverse
of the builders: `parseUnits(formatUnitsExact(x, d), d) === x`.

## Errors

Failures throw `MirrorError` with a machine-readable `code`
(`MIRROR_NODE_ERROR`, `MIRROR_NODE_HTTP_ERROR`,
`MIRROR_NODE_SCHEMA_MISMATCH`, `MALFORMED_RESPONSE`, `TIMED_OUT`,
`NOT_FOUND`, `CONFIG_INVALID`) — deliberately distinct from core's
`HieroError`, so an `instanceof` check tells you which subsystem failed.
HTTP failures also carry the `status` — including `MALFORMED_RESPONSE`
(a body that is not JSON at all, typically a gateway's HTML error page),
where a `status` of 200 is itself the diagnostic.

Absence is a normal answer, not a failure: every "no such entity"
rejection — an HTTP 404 or an empty listing — carries `NOT_FOUND`, and
`orNull` converts exactly those to `null`, re-throwing everything else:

```ts
import { orNull } from "@hiero-hackers/enterprise-mirror";

const account = await orNull(accounts.findAccount("0.0.98"));
if (account === null) {
    // never existed (or not yet imported by this mirror node)
}
```

If the `null` is because the entity was *just* created and hasn't been
imported yet, use [`withRetryOn404()`](#retrying-freshly-created-entities-retryon404)
so the client waits it out before giving up.

## Examples

Runnable, credential-free examples live in
[`samples/examples/src/mirror`](../../samples/examples/src/mirror): account, token/NFT,
transaction, topic and network query tours; a contracts/EVM tour (blocks,
results, logs, `contracts/call`); the read-side counterparts of core's
write services (schedules, airdrops, allowances); time-series building
with ASCII charts; concurrent fan-out through the rate limiter; config &
error-handling patterns; and a rate-limited pagination-at-scale demo.

## License

[Apache-2.0](../../LICENSE)
