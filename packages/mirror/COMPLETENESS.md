# `@hiero-enterprise/mirror` — Mirror Node Completeness Plan

**Goal:** make this package a **complete, drop-in replacement** for the
hand-rolled mirror-node query layer in
[`hiero-mirror-node-explorer`](https://github.com/hiero-ledger/hiero-mirror-node-explorer)
— every query the explorer makes, every parameter it passes, and every
response field it reads should be first-class here, so the explorer can retire
its bespoke axios + cache + pagination code.

This plan is the **package-side** counterpart to the migration audit that lives
in the explorer repo (`hiero-mirror-node-explorer/migration.md`). That document
audits the explorer; this one tracks the work *this package* still owes to make
the migration a clean swap. Cross-references below (§x.y) point at sections of
that audit.

## What "complete" means (definition of done)

The package is complete for the explorer's purposes when all four hold:

1. **Endpoint parity** — every REST endpoint + parameter the explorer calls is
   reachable through a typed method. ✅ **Already met** (43 explorer endpoints,
   all covered; the package covers 48 operations of spec v0.159, enforced by
   the `spec-coverage` drift test).
2. **Navigation parity** — the explorer's interactive tables (prev/next) work
   on top of the package, not just forward drains.
3. **Field parity** — no field the explorer reads off a response is silently
   dropped by the converters.
4. **Call-shape parity** — the package never forces materially more HTTP
   round-trips than the raw API for the same screen.

Items 2–4 are the open work below.

## Status snapshot

| Area | State |
|---|---|
| Endpoint + parameter coverage | ✅ Complete (spec-coverage test enforces it) |
| Bidirectional pagination | ✅ Built — `KeysetPaginator` on branch `reverse-pagination`, not yet merged |
| Field-level completeness | ⚠️ Gaps found (e.g. account `alias` dropped) — audit not yet done |
| Account alias / EVM lookup | ⚠️ `findByAlias` is EVM-only; base32 alias unhandled |
| Embedded-response round-trips | ⚠️ `findByAccountId` drops embedded token balances → extra call |
| Completeness regression test | ❌ Not yet — no test guards field/param parity with the explorer |

---

## Workstreams

### WS1 — Bidirectional (prev/next) pagination · ✅ built, ⏳ merge
Ref: migration §3.2.

The mirror node has no `links.prev`, so `Page.next()` can't drive an
explorer-style table backward. **Done:** `KeysetPaginator` reconstructs the
missing direction (query strictly before the current first row in the inverted
order, then reverse) over the existing repository methods.

- [x] Implement `KeysetPaginator` + types (`packages/mirror/src/utils/KeysetPaginator.ts`)
- [x] Unit tests, README section, cross-links from `Pagination.ts`
- [ ] Review + merge branch `reverse-pagination` into `main`
- [ ] (later, explorer side) delegate a `TableController` to it as the reference adoption

**Acceptance:** `first/next/previous` round-trip exactly; `hasNext/hasPrevious`
exact; merged to `main`.

### WS2 — Field-level completeness audit · ⚠️ open
Ref: migration §3.5 (this is the package half of the type-divergence problem).

The converters transform raw wire → domain model, and in doing so can **drop**
fields the explorer consumes. Confirmed example: the raw account response
carries `alias`, but `MirrorAccountInfo` neither declares nor maps it
(`convertAccountInfo`), while the explorer's `AccountInfo.alias` is used for
base32 alias display/lookup. There are almost certainly more.

- [ ] For each converted type, diff its fields against (a) the raw
      `mirror-node.ts` response type and (b) the fields the explorer's
      `MirrorNodeSchemas.ts` + components actually read.
- [ ] Add every explorer-consumed field that is currently dropped
      (start with account `alias`).
- [ ] Note any intentional omissions with a one-line rationale (mirror the
      style of the `coverage-manifest` `omitted` list).

**Acceptance:** a documented field-by-field parity table; no explorer-consumed
field missing without a stated reason.

### WS3 — Account alias / EVM-address lookup ergonomics · ⚠️ open
Ref: migration §3.1.

`findByAlias` rejects anything that isn't a 0x-20-byte EVM address, but the
explorer also resolves **base32 aliases** (`AccountByAliasCache`). The endpoint
itself accepts id / base32-alias / EVM-address interchangeably.

- [ ] Decide the surface: either (a) document that base32 aliases go through
      `findByAccountId` (its `segment()` only URL-encodes), or (b) add a
      `findByAliasOrAddress` / relax `findByAlias` to accept base32.
- [ ] Tie off with WS2's `alias` field so a resolved account exposes its alias.

**Acceptance:** a base32 alias resolves through a documented, tested path.

### WS4 — Embedded token balances without the double round-trip · ⚠️ open
Ref: migration §3.7.

Raw `GET /accounts/{id}` embeds `balance.tokens[]` (and `transactions[]`), but
`convertAccountInfo` discards them, so "account info + its token balances"
costs two `GET /accounts/{id}` calls (`findByAccountId` + `getBalance`) where
the wire needs one. `RequestGate` rate-limits but does not de-dupe.

- [ ] Let `findByAccountId` optionally surface the embedded token balances
      (e.g. an `includeTokenBalances`/`withTokens` option, or expose them on
      the returned model) so one call yields what the wire already returned.
- [ ] Document the single-call path for the "balance + tokens" screen.

**Acceptance:** the account-summary screen's data is obtainable in one HTTP
call through the package.

### WS5 — Completeness regression test · ❌ open

Coverage is enforced today (spec-coverage drift test); field/param/call-shape
parity is not. Make completeness *enforced, not aspirational* — the same
philosophy as the existing spec test.

- [ ] Add a test that feeds recorded raw fixtures through the converters and
      asserts every explorer-consumed field survives (guards WS2/WS4 from
      regressing).

**Acceptance:** CI fails if a converter starts dropping an explorer-consumed
field.

---

## Explicitly out of scope for this branch

These belong to the explorer's migration, not the package:

- The `schemas ↔ package types` **adapter** the explorer needs (migration §3.5)
  — consumes this package; lives in the explorer.
- The **`AxiosMonitor` loading/error bridge** (migration §3.3).
- Rewiring the explorer's `TableController`/`EntityCache` onto the package.

## Suggested sequence

WS1 (merge) → WS2 (audit, since WS3/WS4 add fields the audit will catalog) →
WS3 + WS4 (the two behavioural gaps) → WS5 (lock it all in). WS3 and WS4 are
independent and can go in parallel.

## References

- `hiero-mirror-node-explorer/migration.md` — the full migration audit (§1–§5).
- `packages/mirror/test/unit/spec-coverage.test.ts` — the endpoint-coverage guarantee.
- `packages/mirror/src/utils/KeysetPaginator.ts` — WS1 (on `reverse-pagination`).
