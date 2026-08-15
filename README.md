# Hiero Enterprise JS

[![CI](../../actions/workflows/build.yml/badge.svg)](../../actions/workflows/build.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Jexsie/4a3c4fd2dae12f95e6177ae3bc807403/raw/hiero-enterprise-js-coverage.json)](../../actions/workflows/build.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hiero-hackers/hiero-enterprise-js/badge)](https://scorecard.dev/viewer/?uri=github.com/hiero-hackers/hiero-enterprise-js)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

Integrating the Hiero SDK into a production Node.js service has historically meant a lot of glue code that has nothing to do with your actual business logic: instantiating clients, managing config, plumbing operator keys, handling errors. 
Similarly, reading data from the mirror node has meant hand-rolling REST calls, pagination, and rate limiting.

Hiero Enterprise JS does that work for you. 

Drop in the middleware or module for your framework of choice and your routes get typed access to accounts, tokens, NFTs, smart contracts, topics, and mirror node queries — without any of the setup code.

It gives each major Node.js framework a native integration that matches how developers already think about that framework — middleware for Express/Fastify, dependency injection for NestJS. Write operations (creating accounts, minting tokens) go through the network client directly. Read operations (looking up balances, browsing NFTs) go through the mirror node REST API, which is faster and doesn't carry transaction fees. Both are exposed through a consistent interface so you don't have to think about which path to use.

## Packages

| Package | Description |
|---------|-------------|
| [`@hiero-hackers/enterprise-core`](./packages/core) | SDK write-side: services, transactions, operator keys — use directly or with any framework |
| [`@hiero-hackers/enterprise-mirror`](./packages/mirror) | Mirror node read-side: repositories, pagination, rate limiting, filters, unit helpers — **zero dependencies, no credentials** |
| [`@hiero-hackers/enterprise-express`](./packages/express) | Express middleware — `req.hiero.*` (composes core + mirror) |
| [`@hiero-hackers/enterprise-fastify`](./packages/fastify) | Fastify plugin — `fastify.hiero.*` (composes core + mirror) |
| [`@hiero-hackers/enterprise-nest`](./packages/nest) | NestJS module — `HieroModule.forRoot()` with full DI (composes core + mirror) |

Each package README documents its full surface — the adapter READMEs
list everything available on `req.hiero` / `app.hiero` / via DI, so you
never have to guess what arrived pre-composed.

### Which package do I install?

| You are building… | Install / import | Reads | Writes |
|---|---|---|---|
| An Express / Fastify / NestJS service | **the adapter only** — repositories and services arrive pre-composed on `req.hiero.*` / `app.hiero.*` / DI; you never import core or mirror directly | ✓ | ✓ |
| A read-only tool, dashboard, or indexer | `@hiero-hackers/enterprise-mirror` only — no credentials needed | ✓ | — |
| A script or worker that submits transactions | `@hiero-hackers/enterprise-core` (add `mirror` if it also reads) | opt-in | ✓ |

## Quick Start

### Standalone (no framework)

```bash
npm install @hiero-hackers/enterprise-core
```

```bash
npm install @hiero-hackers/enterprise-mirror   # read-only? this is the only package you need
```

Reads need no credentials at all:

```ts
import { createMirrorNodeClient, AccountRepository } from '@hiero-hackers/enterprise-mirror';

const mirror = createMirrorNodeClient({ network: 'mainnet' });
const account = await new AccountRepository(mirror).findByAccountId('0.0.800');
```

Writes go through core, with an operator account:

```ts
import { HieroContext, AccountService } from '@hiero-hackers/enterprise-core';

const context = new HieroContext({
  network: 'testnet',
  operatorId: '0.0.12345',
  operatorKey: 'your_private_key_here',
  operatorKeyType: 'ed25519',
});

const accounts = new AccountService(context);
const account = await accounts.createAccount({ publicKey: '...', initialBalance: 10 });
console.log(account.accountId);

context.close();
```

### With a framework

```bash
# Install your framework adapter 
npm install @hiero-hackers/enterprise-express
npm install @hiero-hackers/enterprise-fastify
npm install @hiero-hackers/enterprise-nest
```

Set your operator credentials as environment variables:

```bash
HIERO_NETWORK=testnet
HIERO_OPERATOR_ID=0.0.12345
HIERO_OPERATOR_KEY=your_private_key_here
HIERO_OPERATOR_KEY_TYPE=ECDSA
```

`HIERO_OPERATOR_KEY_TYPE` is **required** and tells the SDK how to parse your private key. Hiero supports multiple key algorithms and there is no reliable way to auto-detect the format from the raw key string alone. Accepted values:

| Value | Description |
|-------|-------------|
| `ECDSA` | ECDSA secp256k1 key — compatible with EVM wallets and most providers |
| `ED25519` | Ed25519 key — native Hiero key type |
| `DER` | DER-encoded key (hex with ASN.1 headers, e.g. `302e020100...`) |

Or pass config directly when registering the integration.

**Express**

```ts
import express from 'express';
import { hieroMiddleware } from '@hiero-hackers/enterprise-express';

const app = express();
app.use(hieroMiddleware());

app.get('/balance', async (req, res) => {
  const balance = await req.hiero.accountService.getOperatorAccountBalance();
  res.json(balance);
});
```

**Fastify**

```ts
import Fastify from 'fastify';
import { hieroPlugin } from '@hiero-hackers/enterprise-fastify';

const app = Fastify();
await app.register(hieroPlugin);

app.get('/balance', async () => {
  return app.hiero.accountService.getOperatorAccountBalance();
});
```

**NestJS**

```ts
import { Module } from '@nestjs/common';
import { HieroModule, AccountService } from '@hiero-hackers/enterprise-nest';

@Module({ imports: [HieroModule.forRoot()] })
export class AppModule {}

@Controller('balance')
export class BalanceController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  getBalance() {
    return this.accounts.getOperatorAccountBalance();
  }
}
```

## Architecture

```
          Express / Fastify / NestJS adapters
     req.hiero.* | fastify.hiero.* | @Inject()
              │ compose both packages │
       ┌──────┴──────────┐  ┌─────────┴──────────┐
       ▼                 ▼  ▼                    ▼
┌───────────────────────┐  ┌────────────────────────┐
│ @hiero-hackers/enterprise-core│  │@hiero-hackers/enterprise-mirror│
│  SDK write-side       │  │  REST read-side        │
│  Account / File /     │  │  9 repositories        │
│  Token / Contract /   │  │  pagination + filters  │
│  Topic / Schedule /   │  │  rate limiting, units  │
│  Network services     │  │                        │
│  HieroContext         │  │  MirrorNodeClient      │
│  deps: @hiero-ledger  │  │  deps: none (fetch)    │
└──────────┬────────────┘  └───────────┬────────────┘
           ▼ gRPC (signed txns)        ▼ REST (free reads)
                      Hiero Network
                   (testnet / mainnet)
```

`@hiero-hackers/enterprise-core` owns the SDK write-side (services, transactions, operator keys).

`@hiero-hackers/enterprise-mirror` owns the REST read-side and has **zero dependencies** — analytics consumers can install it alone, with no SDK and no credentials. 

Framework adapters compose both behind one surface. Either package also works standalone.

Writes go through the Hiero SDK — transactions that go on-chain, signed by the operator. Reads go through the mirror node, which doesn't cost fees and returns historical or indexed data.

## Services

| Service | What it covers |
|--------|---------------|
| `AccountService` | Create, update, delete, approve allowances, check balances |
| `FileService` | Store and retrieve file content on-chain |
| `TokenService` | Create, mint, burn, and transfer fungible tokens and NFTs |
| `ContractService` | Deploy and call EVM-compatible smart contracts |
| `TopicService` | Create topics, manage keys, submit messages |
| `ScheduleService` | Create and sign scheduled transactions |
| `NetworkService` | Network-level queries via the SDK client |

## Mirror Node Queries — `@hiero-hackers/enterprise-mirror`

All mirror node REST reads live in the standalone, **dependency-free**
[`@hiero-hackers/enterprise-mirror`](./packages/mirror) package — no SDK, no
operator keys, just `fetch`. It covers the **complete mirror node REST
API** (all 47 paths and 48 operations of the OpenAPI spec, including the
contracts/EVM family, `contracts/call`, and HIP-1313 fee estimation) with
typed repositories for accounts, blocks, contracts, NFTs, tokens, topics,
transactions, schedules and network state, plus:

- **Continuable pagination** — every list returns a `Page` with a bound
  `next()`; `collectAll` / `paginate` drain or stream any listing.
- **Pro-active rate limiting** — `maxConcurrent` + `maxRequestsPerSecond`
  keep large pulls under the mirror node's limits before any 429.
- **Rich filters** — `limit`/`order`, transaction type + consensus-timestamp
  windows (time-series), point-in-time reads, and balance thresholds.
- **Unit helpers** — tinybar⇄ℏ, token decimals, `Date`⇄consensus timestamps.

```ts
import { createMirrorNodeClient, TransactionRepository, collectAll } from '@hiero-hackers/enterprise-mirror';

const mirror = createMirrorNodeClient({ network: 'mainnet', mirrorNodeMaxRequestsPerSecond: 50 });
const transfers = await collectAll(
  await new TransactionRepository(mirror).find({
    transactionType: 'CRYPTOTRANSFER',
    timestamp: { gte: '1700000000.0', lt: '1700086400.0' },
  }),
  { maxPages: 10 },
);
```

See the [mirror package README](./packages/mirror/README.md) for the full
guide. Framework adapters compose core + mirror automatically, so
`req.hiero.accountRepository` etc. keep working unchanged.

## Samples

Working examples are in [`samples/`](./samples). Each one is a minimal but real service you can run against testnet.

| Sample | Framework |
|--------|-----------|
| [examples](./samples/examples) | Standalone `@hiero-hackers/enterprise-core` scripts |
| [express-sample](./samples/express-sample) | Express |
| [fastify-sample](./samples/fastify-sample) | Fastify |
| [nest-sample](./samples/nest-sample) | NestJS |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report bugs, request features, and submit pull requests. All commits require a DCO sign-off (`git commit -s`) and GPG signing.

## Releasing

Publishing is done by [`.github/workflows/release.yml`](./.github/workflows/release.yml) — it runs when a `v*.*.*` tag is pushed and publishes every public `@hiero-hackers/*` package to npm with provenance. Developers never publish from their machines; the npm token lives only as the org-owned `TOKEN_ENTERPRISE_JS` repository secret.

A release ships **whatever is on `main` at the tagged commit** — it is not tied to any one feature branch. Merge everything you want included first, then cut the release as its own step.

All five packages are versioned **in lockstep**: one version number, one tag. The workflow refuses to publish if the tag, the root `package.json`, and every `packages/*` version don't all agree.

**Prerequisite (one-time):** an npm automation token with publish rights to the `@hiero-hackers` scope, stored as the `TOKEN_ENTERPRISE_JS` repository secret.

**To cut a release:**

1. Make sure everything intended for the release is merged to `main` and CI is green.
2. Choose the new version (pre-1.0: minor `0.x.0` for features, patch `0.0.x` for fixes) and bump the root **and** every publishable package to it, in lockstep:
   ```bash
   NEW=0.3.0
   pnpm --filter "./packages/*" exec npm pkg set version="$NEW"  # the 5 published packages
   npm pkg set version="$NEW"                                    # repo root
   ```
   (The private `samples/*` are never published, so leave them alone.)
3. Optionally sanity-check what would go out — this rewrites `workspace:*` to real versions and packs, without uploading:
   ```bash
   pnpm install --frozen-lockfile && pnpm -r run build
   pnpm -r publish --dry-run --no-git-checks
   ```
4. Open a PR with the bump, get it reviewed, and merge to `main`.
5. From the merged commit on `main`, push a **signed** tag that matches the version (note the `v` prefix):
   ```bash
   git tag -s v0.3.0 -m "v0.3.0" && git push origin v0.3.0
   ```
6. Watch the **Release** workflow in the Actions tab. On success, all five packages are live on npm at the new version.

**Notes**

- The tag must equal the workspace version (`v0.3.0` ↔ `0.3.0`), or the workflow fails before publishing — this is a guard, not a suggestion.
- `pnpm -r publish` skips the `private` root and samples, rewrites each `workspace:*` dependency to the version being published, and publishes in dependency order (`core`/`mirror` before the `express`/`fastify`/`nest` adapters).
- Re-pushing a tag for a version that's already on npm fails cleanly — there is no accidental double-publish. To fix a botched release, bump to the next patch and tag again; published versions are immutable.
- `workflow_dispatch` can run the workflow manually (e.g. to re-attempt a failed publish); it skips the tag/version guards, so use it deliberately.

## License

[Apache-2.0](./LICENSE)
