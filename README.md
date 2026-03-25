# sponsor-wallet-test

Dust sponsorship test using two seed wallets:

- **Sponsor** (pays dust/fees): seed `5b598b6c31c6463c319c0258437ae003612739d308fd6d82c500a477a7d903d8`
- **User** (performs tx): seed `fbeda6cd8f41ba22af745768cdf414f70b354323568d6118fe912a691a1f5cde`

Flow:

1. Both wallets are initialized and synced on Preprod.
2. Sponsor sends NIGHT to the user.
3. A transaction is prepared (unshielded offer); the **user** balances it (shielded + unshielded only, no dust).
4. The **sponsor** adds dust and submits the transaction.

## Setup

```bash
npm install
npm run build
```

## Run

```bash
npm start
# or
node dist/index.js
```

```bash
# dev
npm run dev
```

## Undeployed network (local)

`src/index.ts` uses `UndeployedConfig()` by default. That sets `setNetworkId('undeployed')` so unshielded addresses use HRP `mn_addr_undeployed` (required by the unshielded wallet). Point `indexer` / `node` in `src/config.ts` at your local indexer and RPC (defaults: `127.0.0.1:8088`, `127.0.0.1:9944`). For public preprod, switch to `PreprodConfig()` in `src/index.ts`.

## Full Local Preprod Stack (Docker)

Start Postgres + Cardano node + Cardano db-sync + Midnight node in one command:

```bash
./run-complete-preprod-stack.sh up
```

Other commands:

```bash
./run-complete-preprod-stack.sh status
./run-complete-preprod-stack.sh logs
./run-complete-preprod-stack.sh progress
./run-complete-preprod-stack.sh wait-ready
./run-complete-preprod-stack.sh down
```

Notes:
- First startup can take a long time because `cardano-db-sync` starts from genesis.
- While db-sync catches up, Midnight may log `Main chain state ... not found`.
- Once db-sync has advanced enough, Midnight can verify/import preprod blocks.
- Optional snapshot restore: set `RESTORE_SNAPSHOT=<url>` before `up`.

## Run Log
```bash
npm run dev


> sponsor-wallet-test@1.0.0 dev
> node --experimental-specifier-resolution=node --loader ts-node/esm src/index.ts

(node:227569) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`:
--import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));'
(Use `node --trace-warnings ...` to show where the warning was created)
(node:227569) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
(Use `node --trace-deprecation ...` to show where the warning was created)
[1/8] Network: preprod
[2/8] Initializing sponsor wallet...
[2/8] Initializing user wallet...
[3/8] Waiting for sponsor sync...
[3/8] Sponsor initial unshielded balance: 999999960
[4/8] Sponsor sending Night to user...
[4/8] Waiting for user to receive Night...
[4/8] User received Night: 1000000040
[5/8] Preparing transaction to balance (DApp-style, fake prover)...
[5/8] Transaction to balance prepared.
[6/8] User balancing tx (shielded + unshielded, no dust)...
(FiberFailure) Wallet.Transacting: Failed to clone intent
    at Object.catch (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-unshielded-wallet/dist/v1/TransactionOps.js:45:35)
    at Module.try_ (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/Either.js:81:33)
    at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-unshielded-wallet/dist/v1/TransactionOps.js:43:51 {
  [cause]: Error: Unable to deserialize Intent. Error: expected header tag 'midnight:intent[v6](signature[v1],proof-preimage,embedded-fr[v1]):', got 'midnight:intent[v6](signature[v1],proof,embedded-fr[v1]):����(���'
      at __wbg_Error_e17e777aac105295 (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/ledger-v7/midnight_ledger_wasm_bg.js:9218:17)
      at wasm://wasm/027d23ae:wasm-function[14394]:0x6539e0
      at wasm://wasm/027d23ae:wasm-function[9756]:0x54756c
      at wasm://wasm/027d23ae:wasm-function[10219]:0x5774b9
      at Intent.deserialize (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/ledger-v7/midnight_ledger_wasm_bg.js:4171:26)
      at Object.try (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-unshielded-wallet/dist/v1/TransactionOps.js:44:42)
      at Module.try_ (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/Either.js:79:32)
      at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-unshielded-wallet/dist/v1/TransactionOps.js:43:51
}
```

# try01
```bash
 npm run dev

> sponsor-wallet-test@1.0.0 dev
> node --experimental-specifier-resolution=node --loader ts-node/esm src/index.ts

(node:1131221) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`:
--import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));'
(Use `node --trace-warnings ...` to show where the warning was created)
(node:1131221) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.
(Use `node --trace-deprecation ...` to show where the warning was created)
[1/6] Initializing wallets...
[2/6] Sponsor sending Night to user...
2026-03-18 11:33:33        RPC-CORE: submitAndWatchExtrinsic(extrinsic: Extrinsic): ExtrinsicStatus:: 1010: Invalid Transaction: Custom error: 139
2026-03-18 11:33:33        RPC-CORE: submitAndWatchExtrinsic(extrinsic: Extrinsic): ExtrinsicStatus:: 1010: Invalid Transaction: Custom error: 139
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

Wallet.SubmissionWalletError: Transaction submission error: Transaction submission failed
    at Object.submission (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-shielded/dist/v1/WalletError.js:41:16)
    at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-shielded/dist/v1/Submission.js:28:275
    at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/core.js:520:33
    at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/fiberRuntime.js:945:41 {
  name: '(FiberFailure) Wallet.SubmissionWalletError',
  [Symbol(effect/Runtime/FiberFailure)]: Symbol(effect/Runtime/FiberFailure),
  [Symbol(effect/Runtime/FiberFailure/Cause)]: {
    _tag: 'Fail',
    error: SubmissionError [Wallet.SubmissionWalletError]: Transaction submission error: Transaction submission failed
        at Object.submission (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-shielded/dist/v1/WalletError.js:41:16)
        at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-shielded/dist/v1/Submission.js:28:275
        at EffectPrimitive.effect_instruction_i0 (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/core.js:520:33)
        at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/fiberRuntime.js:945:41
        at effect_internal_function (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/Utils.js:333:12)
        at FiberRuntime.Sync (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/fiberRuntime.js:945:19)
        at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/fiberRuntime.js:1151:31
        at Object.context (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/tracer.js:80:17)
        at FiberRuntime.runLoop (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/fiberRuntime.js:1142:34)
        at FiberRuntime.evaluateEffect (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/effect/dist/esm/internal/fiberRuntime.js:746:27) {
      _tag: 'Wallet.SubmissionWalletError',
      [cause]: SubmissionError: Transaction submission failed
          at file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@midnight-ntwrk/wallet-sdk-node-client/dist/effect/PolkadotNodeClient.js:69:27
          at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {
        txData: Uint8Array(3816) [
          109, 105, 100, 110, 105, 103, 104, 116,  58, 116, 114,  97,
          110, 115,  97,  99, 116, 105, 111, 110,  91, 118,  57,  93,
           40, 115, 105, 103, 110,  97, 116, 117, 114, 101,  91, 118,
           49,  93,  44, 112, 114, 111, 111, 102,  44, 112, 101, 100,
          101, 114, 115, 101, 110,  45, 115,  99, 104, 110, 111, 114,
          114,  91, 118,  49,  93,  41,  58, 108,   0,   8, 212, 180,
            0, 177,  46,  15,   1, 192, 110,  49, 217,  16,   1, 115,
          141,   2,  77,  34, 255,  59,  82,  92, 197,  90,  21,  69,
          117, 199, 183, 121,
          ... 3716 more items
        ],
        _tag: 'SubmissionError',
        [cause]: RpcError: 1010: Invalid Transaction: Custom error: 139
            at checkError (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@polkadot/rpc-provider/coder/index.js:19:15)
            at RpcCoder.decodeResponse (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@polkadot/rpc-provider/coder/index.js:35:9)
            at #onSocketMessageResult (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@polkadot/rpc-provider/ws/index.js:429:40)
            at #onSocketMessage (file:///home/syed/bcwt/midnight/sponsor-wallet-poc/sponsor-wallet-test/node_modules/@polkadot/rpc-provider/ws/index.js:418:42)
            at [nodejs.internal.kHybridDispatch] (node:internal/event_target:845:20)
            at WebSocket.dispatchEvent (node:internal/event_target:778:26)
            at fireEvent (node:internal/deps/undici/undici:11855:14)
            at websocketMessageReceived (node:internal/deps/undici/undici:11877:7)
            at ByteParser.run (node:internal/deps/undici/undici:12499:19)
            at ByteParser._write (node:internal/deps/undici/undici:12392:14)
      }
    }
  }
}

```
