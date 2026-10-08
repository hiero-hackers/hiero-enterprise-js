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

Two packages give you typed access to accounts, tokens, NFTs, smart contracts, topics, and mirror node queries, and work the same in a script, a worker, or any Node.js framework. Write operations (creating accounts, minting tokens) go through the network client directly. Read operations (looking up balances, browsing NFTs) go through the mirror node REST API, which is faster and doesn't carry transaction fees.

## Packages

| Package | Description |
|---------|-------------|
| [`@hiero-hackers/enterprise-core`](./packages/core) | SDK write-side: services, transactions, operator keys — use directly or with any framework |
| [`@hiero-hackers/enterprise-mirror`](./packages/mirror) | Mirror node read-side: repositories, pagination, rate limiting, filters, unit helpers — **zero dependencies, no credentials** |
| [`@hiero-hackers/enterprise-express`](./packages/express) | **Deprecated**: Express middleware. See [migrating](#migrating-from-the-framework-adapters) |
| [`@hiero-hackers/enterprise-fastify`](./packages/fastify) | **Deprecated**: Fastify plugin. See [migrating](#migrating-from-the-framework-adapters) |
| [`@hiero-hackers/enterprise-nest`](./packages/nest) | **Deprecated**: NestJS module. See [migrating](#migrating-from-the-framework-adapters) |

Each package README documents its full surface.

### Which package do I install?

| You are building… | Install / import | Reads | Writes |
|---|---|---|---|
| An Express / Fastify / NestJS service | `@hiero-hackers/enterprise-core` + `@hiero-hackers/enterprise-mirror`, wired once at startup ([how](#using-with-express-fastify-or-nestjs)) | ✓ | ✓ |
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

### Configuration from the environment

Called without arguments, `new HieroContext()` and `createMirrorNodeClient()` read their config from environment variables:

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

## Using with Express, Fastify, or NestJS

No framework-specific package is needed. Create the services once at startup, share them across requests, and close the context on shutdown:

```ts
import { HieroContext, AccountService, TopicService } from '@hiero-hackers/enterprise-core';
import { createMirrorNodeClient, createMirrorRepositories } from '@hiero-hackers/enterprise-mirror';

export function createHiero() {
  const context = new HieroContext(); // reads HIERO_* env vars
  return {
    accountService: new AccountService(context),
    topicService: new TopicService(context),
    ...createMirrorRepositories(createMirrorNodeClient()), // accountRepository, tokenRepository, …
    close: () => context.close(),
  };
}
```

**Express**

```ts
const hiero = createHiero();
const app = express();

app.get('/balance', async (_req, res) => {
  res.json(await hiero.accountService.getOperatorAccountBalance());
});

const server = app.listen(3000);
process.once('SIGTERM', () => server.close(() => hiero.close()));
```

**Fastify**

```ts
const hiero = createHiero();
const app = Fastify();
app.addHook('onClose', () => hiero.close());

app.get('/balance', () => hiero.accountService.getOperatorAccountBalance());
```

**NestJS**: register the classes as providers with factories, so controllers inject them by type:

```ts
@Global()
@Module({
  providers: [
    { provide: HieroContext, useFactory: () => new HieroContext() },
    { provide: MirrorNodeClient, useFactory: () => createMirrorNodeClient() },
    { provide: AccountService, useFactory: (c: HieroContext) => new AccountService(c), inject: [HieroContext] },
    { provide: AccountRepository, useFactory: (m: MirrorNodeClient) => new AccountRepository(m), inject: [MirrorNodeClient] },
  ],
  exports: [HieroContext, MirrorNodeClient, AccountService, AccountRepository],
})
export class HieroModule implements OnApplicationShutdown {
  constructor(private readonly context: HieroContext) {}
  onApplicationShutdown() { this.context.close(); }
}
```

Each [sample](#samples) is a complete, runnable version of the above. Each one also maps `HieroError` / `MirrorError` codes to HTTP statuses (for example `NOT_FOUND` to 404 and `TIMED_OUT` to 504) instead of returning every failure as a 500.

## Migrating from the framework adapters

`@hiero-hackers/enterprise-express`, `@hiero-hackers/enterprise-fastify` and `@hiero-hackers/enterprise-nest` are **deprecated** and will be removed in a future release. They still work, but log a one-time `DeprecationWarning` (silence it with `node --no-deprecation`). The reasoning is in [#238](https://github.com/hiero-hackers/hiero-enterprise-js/issues/238).

1. Replace the adapter dependency with the two packages it wrapped:
   ```bash
   npm uninstall @hiero-hackers/enterprise-express   # or -fastify / -nest
   npm install @hiero-hackers/enterprise-core @hiero-hackers/enterprise-mirror
   ```
2. Add a `createHiero()` (Express/Fastify) or `HieroModule` (NestJS) to your app, as shown [above](#using-with-express-fastify-or-nestjs). It reads the same `HIERO_*` environment variables, so no config changes are needed.
3. Update call sites:

   | Before | After |
   |---|---|
   | `app.use(hieroMiddleware())` | `const hiero = createHiero()` |
   | `req.hiero.accountService` | `hiero.accountService` |
   | `await app.register(hieroPlugin)` | `const hiero = createHiero()` + `app.addHook('onClose', () => hiero.close())` |
   | `app.hiero.tokenRepository` | `hiero.tokenRepository` |
   | `HieroModule.forRoot()` from `enterprise-nest` | your own `HieroModule` |
   | `import { AccountService } from '@hiero-hackers/enterprise-nest'` | `import { AccountService } from '@hiero-hackers/enterprise-core'` |
   | `import { AccountRepository } from '@hiero-hackers/enterprise-nest'` | `import { AccountRepository } from '@hiero-hackers/enterprise-mirror'` |
   | `@InjectHieroContext()` | inject `HieroContext` by type |

4. Close the context on shutdown: the Express middleware never did this, so this step fixes a connection leak.

## Architecture

```
      Your app: script, worker, Express / Fastify / NestJS
              │                          │
              ▼                          ▼
┌───────────────────────┐  ┌────────────────────────┐
│  enterprise-core      │  │  enterprise-mirror     │
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

Use either package on its own, or both together.

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
guide.

## Samples

Working examples are in [`samples/`](./samples). Each one is a minimal but real service you can run against testnet.

| Sample | Framework |
|--------|-----------|
| [examples](./samples/examples) | Standalone `@hiero-hackers/enterprise-core` scripts |
| [express-sample](./samples/express-sample) | Express, using core + mirror directly |
| [fastify-sample](./samples/fastify-sample) | Fastify, using core + mirror directly |
| [nest-sample](./samples/nest-sample) | NestJS, using core + mirror directly |

## Changelog

Notable changes for each release are recorded in [CHANGELOG.md](./CHANGELOG.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report bugs, request features, and submit pull requests. All commits require a DCO sign-off (`git commit -s`) and GPG signing.

## Releasing

Publishing is done by [`.github/workflows/release.yml`](./.github/workflows/release.yml) — it runs when a `v*.*.*` tag is pushed and publishes every public `@hiero-hackers/*` package to the [GitHub Packages npm registry](https://github.com/orgs/hiero-hackers/packages?repo_name=hiero-enterprise-js), then cuts a GitHub Release for the tag. Developers never publish from their machines, and there is no publish token to manage: the workflow authenticates with its own `GITHUB_TOKEN` (`packages: write`). Consumers need a token with `read:packages`; see [Installing the published packages](./CONTRIBUTING.md#installing-the-published-packages).

A release ships **whatever is on `main` at the tagged commit** — it is not tied to any one feature branch. Merge everything you want included first, then cut the release as its own step.

All five packages are versioned **in lockstep**: one version number, one tag. The workflow refuses to publish if the tag, the root `package.json`, and every `packages/*` version don't all agree.

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
4. In [`CHANGELOG.md`](./CHANGELOG.md), rename the `Unreleased` heading to the new version and date, point its link at the `vPREVIOUS...vNEW` comparison, and add a fresh `Unreleased` section above it comparing `vNEW...HEAD`.
5. Open a PR with the bump and changelog, get it reviewed, and merge to `main`.
6. From the merged commit on `main`, push a **signed** tag that matches the version (note the `v` prefix):
   ```bash
   git tag -s v0.3.0 -m "v0.3.0" && git push origin v0.3.0
   ```
7. Watch the **Release** workflow in the Actions tab. On success, all five packages are live on npm at the new version.

**Notes**

- The tag must equal the workspace version (`v0.3.0` ↔ `0.3.0`), or the workflow fails before publishing — this is a guard, not a suggestion.
- `pnpm -r publish` skips the `private` root and samples, rewrites each `workspace:*` dependency to the version being published, and publishes in dependency order (`core`/`mirror` before the `express`/`fastify`/`nest` adapters).
- Re-pushing a tag for a version that's already on the registry fails cleanly — there is no accidental double-publish. To fix a botched release, bump to the next patch and tag again; published versions are immutable.
- `workflow_dispatch` can run the workflow manually (e.g. to re-attempt a failed publish); it skips the tag/version guards, so use it deliberately.

## License

[Apache-2.0](./LICENSE)
