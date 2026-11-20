# Examples

Runnable scripts for `@hiero-hackers/enterprise-core` and `@hiero-hackers/enterprise-mirror`, one feature per file.

Each file is self-contained: it imports only the enterprise packages, `@hiero-ledger/sdk` and Node built-ins, and repeats its own setup, constants and helpers, so you can copy any one of them out as a starting point. The scripts make live network calls.

## Run

From the repository root:

```sh
pnpm --filter @hiero-hackers/examples examples           # every example
pnpm --filter @hiero-hackers/examples examples token     # only src/token/
pnpm --filter @hiero-hackers/examples examples mirror    # only src/mirror/, no credentials needed
```

The filter matches the start of the path under `src/`. Examples run one after another, each under an `[i/N]` header, and the run fails if any example fails.

To run one file:

```sh
cd samples/examples
npx tsx src/mirror/queries.ts
```

## Configuration

Put the variables in a `.env` file in this directory.

**Writes** need an operator account. Each example builds its client with `resolveConfigFromEnv()` from `@hiero-hackers/enterprise-core`, which reads:

```sh
HIERO_NETWORK=testnet                 # testnet, mainnet, previewnet, or a custom name
HIERO_OPERATOR_ID=0.0.12345           # the account that pays the fees
HIERO_OPERATOR_KEY=<your private key>
HIERO_OPERATOR_KEY_TYPE=ed25519       # ed25519, ecdsa or der
```

For a custom network such as local Solo, also set its nodes and mirror node:

```sh
HIERO_NETWORK_NODES=127.0.0.1:50211=0.0.3
HIERO_MIRROR_NETWORK=localhost:5600
HIERO_MIRROR_NODE_URL=http://localhost:5551
```

**Mirror reads** need nothing; these are optional:

| Variable | Default | Notes |
|---|---|---|
| `HIERO_MIRROR_NODE_URL` | `https://mainnet.mirrornode.hedera.com` | Any mirror node REST URL |
| `EXAMPLE_ACCOUNT_ID` | `0.0.98` | A busy account, so results aren't empty |

## What's included

| Folder | Shows | Credentials |
|---|---|---|
| [`account`](./src/account) | Create accounts (single key, multisig, threshold, external or offline signer, scheduled, EVM alias), update, delete, transfer, allowances, signature checks | Operator |
| [`token`](./src/token) | Fungible tokens and NFTs: create, mint, burn, wipe, freeze, KYC, pause, update, fee schedules, associations, airdrops | Operator |
| [`topic`](./src/topic) | Create and update topics | Operator |
| [`file`](./src/file) | Create, read and update files | Operator |
| [`contract`](./src/contract) | Deploy, execute, update and delete contracts | Operator |
| [`schedule`](./src/schedule) | Schedule, sign (also offline) and cancel transactions | Operator |
| [`network`](./src/network) | Connect to a custom network, such as local Solo | Operator |
| [`mirror`](./src/mirror) | Query filters, and paging through results three ways: `page.next()`, `paginate` and `collectAll` | None |

A few mirror methods have no example: account hooks (`findHooks`, `findHookStorage`) and registered nodes (`findRegisteredNodes`) have no data on mainnet yet, and `estimateFees` needs transaction bytes from core. Unit tests cover all of them.
