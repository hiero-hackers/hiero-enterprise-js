# TCK adapter for enterprise-core

A JSON-RPC server that lets the shared [Hiero SDK TCK](https://github.com/hiero-ledger/hiero-sdk-tck) drive `@hiero-hackers/enterprise-core`. Its handlers call core's services instead of the raw SDK, so the TCK checks core's options, validation and errors against the spec. Modelled on the hiero-sdk-js adapter (`tck/` in hiero-ledger/hiero-sdk-js); the key and custom-fee helpers in `utils/` are copied from it.

## What it covers

- Session methods: `setup`, `setOperator`, `reset`, `version`, plus `generateKey`.
- Topic: `createTopic`, `updateTopic`, `deleteTopic`, `submitTopicMessage`, `getTopicInfo`.
- Account: `createAccount`, `updateAccount`, `deleteAccount`, `transferCrypto`, `approveAllowance`, `deleteAllowance`, `getMirrorNodeAccountBalance`.
- Token (needed by the topic and account tests): `createToken`, `updateToken`, `deleteToken`, `updateTokenFeeSchedule`, `associateToken`, `freezeToken`, `pauseToken`, `mintToken`.

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
