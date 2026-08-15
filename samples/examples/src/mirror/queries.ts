/**
 * Run this example with:
 *   npx tsx samples/examples/src/mirror/queries.ts
 *
 * The two things worth demoing about `@hiero-hackers/enterprise-mirror`: passing
 * extra query properties, and walking pagination. Every other method on
 * `MirrorNodeClient` is a `getX` / `queryX(id)` you can discover from the
 * types — see `packages/mirror/README.md` for the full surface.
 *
 * All calls are read-only, so no operator credentials are needed. We use
 * `queryTransactionsByAccount` throughout because it exposes both features
 * (a rich filter object and a naturally-paginated result).
 *
 * Configure via env (all optional):
 *   HIERO_MIRROR_NODE_URL   default: https://mainnet.mirrornode.hedera.com
 *   EXAMPLE_ACCOUNT_ID      default: 0.0.98  (busy account, always populated)
 */
import {
    MirrorNodeClient,
    collectAll,
    paginate,
} from "@hiero-hackers/enterprise-mirror";

const mirrorUrl =
    process.env["HIERO_MIRROR_NODE_URL"] ??
    "https://mainnet.mirrornode.hedera.com";
const accountId = process.env["EXAMPLE_ACCOUNT_ID"] ?? "0.0.98";

// The client caps parallel requests and per-second throughput so a burst
// of page fetches stays polite to the public mirror node.
const mirror = new MirrorNodeClient(mirrorUrl, {
    maxConcurrent: 5,
    maxRequestsPerSecond: 50,
    // Canary tolerance: this example doubles as the weekly public-mainnet
    // smoke run, and the public mirror's p99 occasionally exceeds the
    // 10s library default. A patient canary alerts on real drift, not on
    // one slow day (the library default stays 10s for real consumers).
    //
    // 60s, not 30s, because of the account this example queries. 0.0.98 is
    // the fee-collection account — deliberately chosen as "always populated",
    // but that also makes it one of the busiest on mainnet, and
    // `?account.id=0.0.98&limit=1&order=desc` is expensive to serve cold.
    // Measured against public mainnet: 22.7s on a cold cache, then ~0.04s
    // once warm. 30s sat close enough to that cold-path cost that an
    // ordinary slow day tripped it, and the retries timed out too — a ~121s
    // failure that looked like drift but was just a tight budget.
    timeoutMs: 60_000,
});

console.log(`Mirror queries example`);
console.log(`  mirror : ${mirrorUrl}`);
console.log(`  account: ${accountId}\n`);

// ── Extra query properties ───────────────────────────────────────
// Every list method takes an optional query object. The fields on it map
// 1:1 to the mirror node's REST parameters, with ranges expressed as
// `{ gte, lt, ... }`. Compose them freely — the mirror node ANDs them.
//
// This one call combines: page size, sort order, a category filter, and
// a consensus-timestamp window anchored to "one day before the newest
// transaction" (rather than the wall clock, so the demo works even if the
// account has been quiet).
const newest = await mirror.queryTransactionsByAccount(accountId, {
    limit: 1,
    order: "desc",
});
const anchorSeconds = newest.data[0]
    ? Math.floor(Number(newest.data[0].consensusTimestamp))
    : Math.floor(Date.now() / 1000);
const since = `${anchorSeconds - 24 * 60 * 60}.000000000`;

const filtered = await mirror.queryTransactionsByAccount(accountId, {
    transactionType: "CRYPTOTRANSFER",
    timestamp: { gte: since },
    order: "desc",
    limit: 5,
});
const anchorIso = new Date(anchorSeconds * 1000).toISOString();
console.log(`Filter: CRYPTOTRANSFER in the 24h before ${anchorIso}`);
console.log(`  matched ${filtered.data.length} tx (limit was 5):`);
for (const tx of filtered.data) {
    console.log(`    ${tx.consensusTimestamp}  ${tx.type}`);
}
console.log(`  more pages available: ${filtered.next !== null}\n`);

// ── Pagination — three ways to walk the same next() link ─────────
// Every list method returns a `Page<T>` with:
//   • `data`   — the current page's items
//   • `next`   — either null (last page) or a function that fetches the
//                next page, preserving the original query.
// The three patterns below only differ in ergonomics — the underlying
// HTTP calls are identical.

// (1) Manual — walk `next()` yourself. Good when your stop condition is
// dynamic ("stop when I see X") and you want full control over each hop.
const firstPage = await mirror.queryTransactionsByAccount(accountId, {
    limit: 25,
    order: "desc",
});
console.log(`Pagination · manual — walk page.next() yourself`);
console.log(`  page 1: ${firstPage.data.length} tx`);
if (firstPage.next) {
    const secondPage = await firstPage.next();
    console.log(`  page 2: ${secondPage.data.length} tx`);
    console.log(`  a third page exists: ${secondPage.next !== null}`);
}
console.log();

// (2) Streaming — `paginate()` yields one page at a time. Best for
// aggregating: fold each page into your running totals and never hold
// more than a single page in memory, no matter how deep the listing goes.
console.log(`Pagination · streaming — for await (const page of paginate(...))`);
const stopAfter = 3;
let scanned = 0;
let pages = 0;
for await (const page of paginate(firstPage)) {
    scanned += page.length;
    pages++;
    console.log(
        `  page ${pages}: ${page.length} tx (running total ${scanned})`,
    );
    if (pages >= stopAfter) break; // no further pages are fetched
}
console.log();

// (3) One-shot — `collectAll()` drains into a single array. Use the
// `maxPages` / `maxItems` caps so an unexpectedly huge account can't
// exhaust memory.
const collectOptions = { maxPages: 3 };
const collected = await collectAll(firstPage, collectOptions);
console.log(
    `Pagination · one-shot — collectAll(page, ${JSON.stringify(collectOptions)})`,
);
console.log(
    `  pulled ${collected.length} tx across ${collectOptions.maxPages} pages`,
);
