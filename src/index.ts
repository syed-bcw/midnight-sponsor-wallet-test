// Dust sponsorship - same flow as docs-snippets/dust-sponsorship.ts
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { Buffer } from 'buffer';
import * as rx from 'rxjs';
import { aFakeProvingProvider, initWalletWithSeed } from './utils.js';
import { PreprodConfig } from './config.js';
import { WebSocket } from 'ws';

globalThis.WebSocket = WebSocket as any;

/*
 * Dust sponsorship: user wallet used for shielded/unshielded only; sponsor pays fees.
 * 1. Transaction prepared outside (DApp-style), 2. user balances without paying fees,
 * 3. sponsor pays fees and submits.
 */

const config = new PreprodConfig();

console.log('[1/6] Initializing wallets...');
const sponsor = await initWalletWithSeed(
  Buffer.from('5b598b6c31c6463c319c0258437ae003612739d308fd6d82c500a477a7d903d8', 'hex'),
  config,
);
const user = await initWalletWithSeed(
  Buffer.from('fbeda6cd8f41ba22af745768cdf414f70b354323568d6118fe912a691a1f5cde', 'hex'),
  config,
);
const nightAmountToSend = 10n;

const initialSenderState = await rx.firstValueFrom(
  sponsor.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);
const initialBalance = initialSenderState.unshielded.balances[ledger.nativeToken().raw] ?? 0n;

console.log('[2/6] Sponsor sending Night to user...');
await sponsor.wallet
  .transferTransaction(
    [
      {
        type: 'unshielded',
        outputs: [
          {
            amount: nightAmountToSend,
            receiverAddress: user.unshieldedKeystore.getBech32Address().toString(),
            type: ledger.nativeToken().raw,
          },
        ],
      },
    ],
    {
      shieldedSecretKeys: sponsor.shieldedSecretKeys,
      dustSecretKey: sponsor.dustSecretKey,
    } as any,
    { ttl: new Date(Date.now() + 30 * 60 * 1000) },
  )
  .then((recipe) => sponsor.wallet.signRecipe(recipe, (payload) => sponsor.unshieldedKeystore.signData(payload)))
  .then((recipe) => sponsor.wallet.finalizeRecipe(recipe))
  .then((tx) => sponsor.wallet.submitTransaction(tx));

console.log('[2/6] Waiting for user to receive Night...');
const userReceivedNight = await rx.firstValueFrom(
  user.wallet.state().pipe(
    rx.filter((state) => state.isSynced),
    rx.filter((state) => (state.unshielded.balances[ledger.nativeToken().raw] ?? 0n) > 0n),
  ),
);
console.log(
  '[2/6] User received Night:',
  userReceivedNight.unshielded.balances[ledger.nativeToken().raw],
);

console.log('[3/6] Preparing transaction to balance (DApp-style, fake prover)...');
const prepareTransactionToBalance = async () => {
  const unshieldedOffer = ledger.UnshieldedOffer.new(
    [],
    [
      {
        value: nightAmountToSend,
        owner: sponsor.unshieldedKeystore.getAddress(),
        type: ledger.nativeToken().raw,
      },
    ],
    [],
  );
  const intent = ledger.Intent.new(new Date(Date.now() + 30 * 60 * 1000));
  intent.fallibleUnshieldedOffer = unshieldedOffer;
  const unprovenTransaction = ledger.Transaction.fromParts(
    'preprod',
    undefined,
    undefined,
    intent,
  );
  return await unprovenTransaction.prove(
    aFakeProvingProvider,
    ledger.LedgerParameters.initialParameters().transactionCostModel.runtimeCostModel,
  );
};
const transactionToBalance = await prepareTransactionToBalance();
console.log('[3/6] Transaction to balance prepared.');

console.log('[4/6] User balancing tx (shielded + unshielded, no dust)...');
const transactionWithoutFees = await user.wallet
  .balanceUnboundTransaction(
    transactionToBalance as any,
    {
      shieldedSecretKeys: user.shieldedSecretKeys,
      dustSecretKey: user.dustSecretKey,
    } as any,
    {
      ttl: new Date(Date.now() + 30 * 60 * 1000),
      tokenKindsToBalance: ['shielded', 'unshielded'],
    },
  )
  .then((recipe) => user.wallet.signRecipe(recipe, (payload) => user.unshieldedKeystore.signData(payload)))
  .then((tx) => user.wallet.finalizeRecipe(tx));
console.log('[4/6] User balance + sign + finalize done.');

console.log('[5/6] Sponsor adding dust, signing, finalizing, submitting...');
await sponsor.wallet
  .balanceFinalizedTransaction(
    transactionWithoutFees,
    {
      shieldedSecretKeys: sponsor.shieldedSecretKeys,
      dustSecretKey: sponsor.dustSecretKey,
    } as any,
    {
      ttl: new Date(Date.now() + 30 * 60 * 1000),
      tokenKindsToBalance: ['dust'],
    },
  )
  .then((recipe) => sponsor.wallet.signRecipe(recipe, (payload) => sponsor.unshieldedKeystore.signData(payload)))
  .then((recipe) => sponsor.wallet.finalizeRecipe(recipe))
  .then((finalizedTransaction) => sponsor.wallet.submitTransaction(finalizedTransaction));
console.log('[5/6] Sponsor submitted transaction.');

console.log('[6/6] Reading final state...');
const finalSponsorState = await rx.firstValueFrom(
  sponsor.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);
const finalUserState = await rx.firstValueFrom(
  user.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);

console.log('[6/6] Sponsored transfer completed');
console.log(
  '  Sponsor received their night back?',
  (finalSponsorState.unshielded.balances[ledger.nativeToken().raw] ?? 0n) === initialBalance,
);
console.log(
  '  User spent all the Night?',
  (finalUserState.unshielded.balances[ledger.nativeToken().raw] ?? 0n) === 0n,
);

await user.wallet.stop();
await sponsor.wallet.stop();
