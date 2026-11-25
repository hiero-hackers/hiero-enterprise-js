# TCK adapter for enterprise-core

A JSON-RPC server that lets the shared [Hiero SDK TCK](https://github.com/hiero-ledger/hiero-sdk-tck) drive `@hiero-hackers/enterprise-core`. Its handlers call core's services instead of the raw SDK, so the TCK checks core's options, validation and errors against the spec. Modelled on the hiero-sdk-js adapter (`tck/` in hiero-ledger/hiero-sdk-js); the key and custom-fee helpers in `utils/` are copied from it.

## What it covers

- Session methods: `setup`, `setOperator`, `reset`, `version`, plus `generateKey`.
- Topic: `createTopic`, `updateTopic`, `deleteTopic`, `submitTopicMessage`, `getTopicInfo`.
- Account: `createAccount`, `updateAccount`, `deleteAccount`, `transferCrypto`, `approveAllowance`, `deleteAllowance`, `getMirrorNodeAccountBalance`.
- Schedule: `createSchedule` (scheduling a two-leg HBAR transfer, `mintToken`, `burnToken` or `createTopic`), `signSchedule`, `deleteSchedule`, `getScheduleInfo`.
- File: `createFile`, `updateFile`, `appendFile`, `deleteFile`, `getFileContents`, `getFileInfo`.
- Network: `getTransactionReceipt`, `getAddressBook`.
- Token: `createToken`, `updateToken`, `deleteToken`, `updateTokenFeeSchedule`, `associateToken`, `dissociateToken`, `freezeToken`, `unfreezeToken`, `pauseToken`, `unpauseToken`, `grantTokenKyc`, `revokeTokenKyc`, `mintToken`, `burnToken`, `wipeToken`, `airdropToken`, `claimToken`, `cancelAirdrop`, `rejectToken`, `getTokenInfo`, `getTokenNftInfo`, `getMirrorNodeTokenBalance`.

Requests core can't express (for example a custom `transactionId`, or a multi-leg `transferCrypto`) answer with the TCK's `NOT_IMPLEMENTED` result, so the TCK skips those tests; the adapter logs each one. Methods it doesn't register are skipped too.

## Run it

1. Start a local Solo network with the TCK's default ports (consensus `50211`, mirror REST `5551`, mirror gRPC `5600`, mirror REST Java `8084`).
2. Build core and start the adapter (port `8544`):
   ```sh
   pnpm install && pnpm --filter @hiero-hackers/enterprise-core run build
   MIRROR_NODE_REST_URL=http://127.0.0.1:5551 pnpm --filter @hiero-hackers/tck-adapter start
   ```
3. In a checkout of hiero-sdk-tck (v0.14.0), set `.env` (operator, node and mirror endpoints, `JSON_RPC_SERVER_URL=http://localhost:8544/`) and run a folder:
   ```sh
   npx mocha --require ts-node/register --require tsconfig-paths/register --require src/preflight.ts 'src/tests/topic-service/**/*.ts' --timeout 90000 --exit
   ```

## In CI

`.github/workflows/tck.yml` runs every TCK folder on every pull request and on demand, one job per folder: each builds core, starts this adapter and a Solo network on the TCK's default ports, then runs the TCK's own action (`hiero-ledger/hiero-sdk-tck`, pinned to a release commit) on its folder. Pushing a branch named `tck/<folder>` (for example `tck/file-service`) runs only that folder, without a pull request. The job summary has the counts and the mochawesome report is uploaded as `tck-report`.

The TCK action fails on any failure, so the job decides with `.github/scripts/check-tck-results.mjs`: it fails on a failure that isn't listed under its folder in [`known-differences.json`](known-differences.json), and on a listed test that no longer fails. The list holds the tests core answers differently on purpose, such as rejecting a zero-amount transfer, each with the reason. Add a test there only for a deliberate difference; fix core for anything else.
