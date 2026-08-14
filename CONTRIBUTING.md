# Contributing to Hiero Enterprise JS

Thank you for your interest in contributing to Hiero Enterprise JS!

We appreciate your interest in helping us and the rest of our community. We welcome bug reports, feature requests, and code contributions.

**Jump To:**

- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Code Contributions](#code-contributions)

## Bug Reports

Bug reports are accepted through the [Issues][issues] page.

The [bug][label-bug] label is used to track bugs.

### Before Submitting a Bug Report

Before submitting a bug report, please do the following:

1. Do a search through the existing issues to make sure it has not already been reported. If you find that the bug has already been raised, please give it a +1 to help us to decide which issues we prioritise.

2. If possible, upgrade to the latest release of the library. It's possible the bug has already been fixed in the latest version.

If you have completed these steps and you need to submit a bug report, please read the guidelines below.

### Submitting a Bug Report

Please ensure that your bug report contains the following:

- A short, descriptive title. Other community members should be able to understand the nature of the issue by reading this title.
- A succinct, detailed description of the problem you're experiencing. This should include:
    - Expected behaviour of the library and the actual behaviour exhibited.
    - Any details of your application development environment that may be relevant (Node.js version, framework, network).
    - If applicable, the exception stack-trace.
    - If you are able to create one, include a [Minimal Working Example][mwe] that reproduces the issue.
- [Markdown][markdown] formatting as appropriate to make the report easier to read; for example use code blocks when pasting a code snippet or exception stack-trace.

## Requirements

- `pnpm` (latest) — https://pnpm.io
- `node` (≥22) — https://nodejs.org

## Building the Library

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests
pnpm test

# Lint (type check + ESLint)
pnpm lint

# Format code
pnpm format
```

Once building and testing pass, see the [samples](samples/README.md) for
runnable examples of each package (Express/Fastify/NestJS integrations,
plus a mirror-node example gallery that needs no credentials).

## Installing the published packages

Releases are published to the **GitHub Packages npm registry**, not
npmjs.org. GitHub Packages requires authentication even for public
packages, so consumers need two lines of `.npmrc` and a token with
`read:packages`:

```ini
# .npmrc (consumer project root)
@hiero-hackers:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
npm install @hiero-hackers/enterprise-mirror
```

- **CI** — use a repo/org secret holding a token with `read:packages`,
  exported as `NODE_AUTH_TOKEN` in the workflow environment.
- **Local development** — create a classic personal access token with the
  `read:packages` scope and export it as `NODE_AUTH_TOKEN` (or put it in
  your user-level `~/.npmrc`; never commit a token).
- **This monorepo's own workspaces** are unaffected — `workspace:*`
  dependencies resolve locally and never hit the registry.

Publishing happens only in CI (`.github/workflows/release.yml`), on a
version tag, using the workflow's own `GITHUB_TOKEN` — there is no
publish token to manage. Once the publish succeeds the same workflow cuts
a [GitHub Release](https://github.com/hiero-hackers/hiero-enterprise-js/releases)
for the tag, so the Releases tab always mirrors what is on the registry.

### Test quick reference

| What it proves                             | Command                                                                                                                             | Network needed                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| All packages' unit tests                   | `pnpm test`                                                                                                                         | none                                        |
| Mirror unit tests + spec-coverage tripwire | `pnpm --filter @hiero-hackers/enterprise-mirror test`                                                                                       | none                                        |
| Mirror unit tests with coverage gates      | `pnpm --filter @hiero-hackers/enterprise-mirror run test:unit:coverage`                                                                     | none                                        |
| Core SDK end-to-end                        | `pnpm --filter @hiero-hackers/enterprise-core run test:integration`                                                                         | local Solo                                  |
| Mirror write→read round-trips              | `pnpm --filter @hiero-hackers/enterprise-mirror run test:integration`                                                                       | local Solo (self-skips without credentials) |
| Live behavior of every mirror query        | `pnpm --filter @hiero-hackers/examples examples mirror` (also weekly via [`mainnet-smoke`](.github/workflows/mainnet-smoke.yml)) | public mainnet (read-only, keyless)         |
| Upstream OpenAPI spec drift                | weekly [`spec-drift`](.github/workflows/spec-drift.yml) workflow, or `gh workflow run spec-drift.yml`                               | GitHub                                      |
| Response-field completeness                | `node spec/diff-response-fields.mjs` from `packages/mirror` (also a CI step)                                                        | none                                        |

CI runs the first five automatically (Solo is provisioned in the workflow);
the examples run there against Solo too, with the mainnet-dependent mirror
tours skipped via `EXAMPLES_SKIP=mirror/`.

### Running Integration Tests

Integration tests live under [`packages/core/test/integration/`](packages/core/test/integration) and exercise the SDK end-to-end against a live consensus + mirror node. They are designed to run against a local [Solo](https://solo.hiero.org) network.

1. **Bring up a Solo network locally** by following the [Solo quickstart](https://solo.hiero.org/docs/simple-solo-setup/quickstart/) (requires Docker, 12+ GB RAM, and a local Kubernetes cluster — Kind / Minikube / similar).

2. **Copy the env template:**

    ```bash
    cp packages/core/test/.env.example packages/core/test/.env
    ```

    The defaults point at the Solo genesis treasury (`0.0.2`) and the standard Solo node + mirror ports, so no edits are needed for the common case. The test runner auto-loads `packages/core/test/.env` via [`test/utils/setup-env.ts`](packages/core/test/utils/setup-env.ts).

3. **Run the integration suite:**

    ```bash
    pnpm run test:integration

    # or with a coverage report (lcov + text summary written to
    # packages/core/coverage/integration/)
    pnpm run test:integration:coverage
    ```

**Using a custom operator instead of the genesis treasury** — create a fresh account on the Solo deployment, then swap `HIERO_OPERATOR_ID` / `HIERO_OPERATOR_KEY` / `HIERO_OPERATOR_KEY_TYPE` in `.env` for the values Solo prints:

```bash
# ED25519 operator (default)
solo ledger account create --deployment solo-deployment --hbar-amount 100 --private-key --dev

# ECDSA operator — also set HIERO_OPERATOR_KEY_TYPE=ecdsa in .env
solo ledger account create --deployment solo-deployment --hbar-amount 100 --generate-ecdsa-key --private-key --dev
```

Coverage thresholds (80% statements / 70% branches / 80% functions / 80% lines) are enforced by the unit run only; the integration run emits coverage without gating.

### Mirror round-trip tests

The mirror package has its own integration suite,
[`packages/mirror/test/integration/`](packages/mirror/test/integration), which
round-trips entities end-to-end: core _writes_ a topic/token on the network,
the mirror repositories _read_ it back from the mirror node. This is the layer
that catches mirror node response-shape drift — CI runs it against Solo's
mirror node right after the core integration tests, using the same
environment variables:

```bash
pnpm --filter @hiero-hackers/enterprise-mirror run test:integration
```

The suite auto-loads the same `packages/core/test/.env` described above, so
one Solo env file drives both integration suites. Without credentials (no
`.env` and nothing in the shell) it skips itself — `5 skipped` is the
expected local output, not a failure — so plain `pnpm test` runs are
unaffected.

No Solo? The round-trips also work against **testnet** with a funded
[testnet account](https://portal.hedera.com):

```bash
HIERO_NETWORK=testnet \
HIERO_OPERATOR_ID=0.0.xxxx \
HIERO_OPERATOR_KEY=... \
HIERO_OPERATOR_KEY_TYPE=ECDSA \
HIERO_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com \
pnpm --filter @hiero-hackers/enterprise-mirror run test:integration
```

### Mirror spec coverage & drift

`@hiero-hackers/enterprise-mirror` claims **complete** coverage of the mirror node
REST API, and that claim is enforced rather than aspirational:

- The official OpenAPI spec is vendored at
  [`packages/mirror/spec/openapi.yml`](packages/mirror/spec) (upstream commit
  pinned in `spec/SNAPSHOT`).
- [`spec-coverage.test.ts`](packages/mirror/test/unit/spec-coverage.test.ts)
  diffs every operation and query parameter against the coverage manifest in
  both directions on every build.
- The weekly [`spec-drift`](.github/workflows/spec-drift.yml) workflow diffs
  the snapshot against upstream `main` and opens an issue when the API grows.

### Adding a mirror endpoint

The package is deliberately layered — raw wire type → converter → client
method → repository method — so each concern is testable in isolation.
Adding an endpoint touches one spot in each layer, in this order:

1. **Raw type** in [`src/types/mirror-node.ts`](packages/mirror/src/types/mirror-node.ts) —
   the snake_case shape the API sends (keep it in this file; the field-diff
   tool parses it).
2. **Public type** in the matching `src/types/*.ts` — the camelCase shape
   consumers see. Export both from [`src/types/index.ts`](packages/mirror/src/types/index.ts).
3. **Converter** in [`src/mirror-node-converters.ts`](packages/mirror/src/mirror-node-converters.ts)
   mapping raw → public. Single-object endpoints also get a **validator**
   in [`src/mirror-node-validators.ts`](packages/mirror/src/mirror-node-validators.ts).
4. **Query type** in [`src/types/query.ts`](packages/mirror/src/types/query.ts)
   for any filters (reuse `RangeFilter` / `EntityIdFilter` / `TimestampFilter`).
5. **Client method** in the matching `// ───` section of
   [`src/client/MirrorNodeClient.ts`](packages/mirror/src/client/MirrorNodeClient.ts) —
   wrap every path parameter in `segment(...)`, and go through
   `this.request(...)`, never `fetch` directly: rate limiting, retries,
   observer telemetry (#145), and response parsing all assume that single
   transport choke point (a guard test enforces it).
6. **Repository method** in the matching `src/repositories/*.ts` (a thin
   delegator). A brand-new repository also goes in
   [`repositories/factory.ts`](packages/mirror/src/repositories/factory.ts) —
   from there it flows into every adapter automatically.
7. **Mock** entry in [`test/utils/mock-mirror-node.ts`](packages/mirror/test/utils/mock-mirror-node.ts)
   (the mapped type makes a missing method a compile error).
8. **Tests**: a URL-exactness + conversion case, a repository-forwarding
   case, and — for a new endpoint or parameter — an update to
   [`test/spec/coverage-manifest.ts`](packages/mirror/test/spec/coverage-manifest.ts).

Then `pnpm --filter @hiero-hackers/enterprise-mirror test` — the spec-coverage and
field-diff checks tell you immediately if a layer was missed. The refresh
runbook for the vendored spec itself lives in
[`packages/mirror/spec/README.md`](packages/mirror/spec/README.md).

## Naming & Structure Conventions

Machine-checked by `node scripts/check-conventions.mjs` (runs in CI) —
if it passes, you follow the conventions.

| Thing | Convention | Example |
| --- | --- | --- |
| Class-bearing source file | PascalCase, named after the class | `MirrorNodeClient.ts` |
| Function-only / type module | lowercase, in a domain directory | `config.ts`, `types/account.ts` |
| Cross-domain function modules | `src/utils/` (PascalCase modules) | `utils/MirrorNodeConverters.ts` |
| Source directory | every multi-file dir has an `index.ts` barrel; the root index exports via barrels only | `repositories/index.ts` |
| Unit test | `*.test.ts`, mirrors `src/` path, named after the implementation file | `test/unit/utils/Units.test.ts` |
| Large-surface unit tests | facet suffix on the implementation name | `MirrorNodeClient.pagination.test.ts` |
| Cross-cutting unit suites | `test/unit/` root, descriptive kebab name | `spec-coverage.test.ts` |
| Integration test | `*.spec.ts`, grouped by feature domain | `test/integration/account/…` |
| Cross-domain integration flows | `test/integration/` root | `key-types.spec.ts` |
| Sample directory / package | `<thing>-sample` / `hiero-<thing>-sample`, version `1.0.0` | `express-sample` |
| Shared types | in `src/types/`, exported via the `types/index.ts` barrel | `types/page.ts` |
| Companion types (one class's options) | stay in the class's file; named type re-exports use `export type` | `export type { MirrorNodeClientOptions }` |


## Verifying the Published Type Surface

The `.d.ts` / `.d.cts` files under each package's `dist/` are generated,
and their correctness is a chain — each link has a one-command local
check (all from the repo root; CI runs every one of these on push):

| Claim | Check | Pass looks like |
|---|---|---|
| Source types compile (strict) | `pnpm --filter @hiero-hackers/enterprise-mirror exec tsc --noEmit` | no output |
| Packed `exports` serve matching JS + declarations in every consumer mode | `cd packages/mirror && npx @arethetypeswrong/cli --pack` | all 🟢, "No problems found" |
| Wire types match the mirror node OpenAPI spec, field by field | `cd packages/mirror && node spec/diff-response-fields.mjs` | exit 0 |
| Converters behave, not just typecheck | `pnpm --filter @hiero-hackers/enterprise-mirror test` | all tests pass |
| Types survive real mainnet responses | `HIERO_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com pnpm --filter @hiero-hackers/examples examples mirror` | live figures, no `undefined`/`NaN` |

The same applies to every package (`core`, `express`, `fastify`,
`nest`) — substitute the package name in the first two commands. The
adapters and samples typecheck against the **built** `dist`
declarations, so a full `pnpm run build` followed by per-package
`tsc --noEmit` re-validates the exact surface an npm consumer sees.

## Feature Requests

Feature requests are also submitted through the [Issues][issues] page.

As with Bug Reports, please do a search of the open requests first before submitting a new one to avoid duplicates. If you do find a feature request that represents your suggestion, please give it a +1.

**NOTE:** If you intend to implement this feature, please submit the feature request _before_ working on any code changes. This will allow maintainers to assess the idea, discuss the design with you and ensure that it makes sense to include such a feature in the library.

Feature requests are labeled as [enhancements][label-enhancement].

### Submitting a Feature Request

Open an [issue][issues] with the following:

- A short, descriptive title. Other community members should be able to understand the nature of the issue by reading this title.
- A detailed description of the proposed feature. Explain why you believe it should be added to the library. Illustrative example code may also be provided to help explain how the feature should work.
- [Markdown][markdown] formatting as appropriate to make the request easier to read.
- If you plan to implement this feature yourself, please let us know that you'd like the issue to be assigned to you.

## Code Contributions

Code contributions are handled using [Pull Requests][pull-requests]. Please keep the following in mind when considering a code contribution:

- The library is released under the [Apache 2.0 License][license].

    Any code you submit will be released under this license.

- For anything other than small or quick changes, you should always start by reviewing the [Issues][issues] page to ensure that nobody else is already working on the same issue.

    If you're working on a bug fix, check to see whether the bug has already been reported. If it has but no one is assigned to it, ask one of the maintainers to assign it to you before beginning work. If you're confident the bug hasn't been reported yet, create a new [Bug Report](#bug-reports) and ask us to assign it to you.

    If you are thinking about adding entirely new functionality, open a [Feature Request](#feature-requests) to ask for feedback first before beginning work; this is to ensure that nobody else is already working on the feature and to confirm that it makes sense for such functionality to be included in the library.

- All code contributions must be accompanied with new or modified tests that verify that the code works as expected; i.e. that the issue has been fixed or that the functionality works as intended.

### Coding Standards

- **TypeScript** — strict mode, no implicit `any`
- **ESLint** — `typescript-eslint` recommended rules with Prettier integration
- **Prettier** — enforced formatting (single quotes, trailing commas, 80-char width)
- **Naming** — `PascalCase` for classes/interfaces, `camelCase` for functions/variables
- **Imports** — use `import type` for type-only imports
- **Tests** — use [Vitest](https://vitest.dev/); aim for coverage of all public API methods

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat:     New feature
fix:      Bug fix
docs:     Documentation
chore:    Maintenance (deps, CI, config)
refactor: Code restructuring
test:     Adding/updating tests
```

### DCO Sign-Off

This project uses the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) to certify that contributors have the right to submit their code.

**Every commit must include a `Signed-off-by` trailer** with your real name and email:

```
Signed-off-by: Jane Doe <jane@example.com>
```

Add it automatically with the `-s` flag:

```bash
git commit -s -m "feat: add scheduled transaction support"
```

If you forgot to sign off, amend the last commit:

```bash
git commit --amend -s --no-edit
```

### GPG Signed Commits

We recommend that all commits are GPG-signed. Follow GitHub's guide to [sign commits with GPG](https://docs.github.com/en/authentication/managing-commit-signature-verification).

```bash
# Enable auto-signing
git config commit.gpgsign true
```

### Pull Request Readiness

Before submitting your pull request, refer to the pull request readiness checklist below:

- [ ] Includes tests to exercise the new behaviour
- [ ] Code is documented, especially public and user-facing constructs
- [ ] Local run of `pnpm run build` succeeds
- [ ] Linting passes: `pnpm run lint`
- [ ] Formatting passes: `pnpm run format:check`
- [ ] Unit tests pass: `pnpm run test`
- [ ] Git commit message is detailed and includes context behind the change
- [ ] Commits are signed off (`git commit -s`) and GPG-signed
- [ ] If the change is related to an existing Bug Report or Feature Request, please include its issue number

To contribute, please fork the GitHub repository and submit a pull request to the `main` branch.

### Getting Your Pull Request Merged

All Pull Requests must be approved by at least one maintainer before it can be merged. Maintainers only have limited bandwidth to review Pull Requests so it's not unusual for a Pull Request to go unreviewed for a few days, especially if it's a large or complex one.

[license]: ./LICENSE
[mwe]: https://en.wikipedia.org/wiki/Minimal_Working_Example
[markdown]: https://guides.github.com/features/mastering-markdown/
[issues]: ../../issues
[pull-requests]: ../../pulls
[label-bug]: ../../labels/bug
[label-enhancement]: ../../labels/enhancement
