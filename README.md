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