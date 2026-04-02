// Dust sponsorship - same flow as midnight-wallet docs-snippets/dust-sponsorship.ts
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { Buffer } from 'buffer';
import * as rx from 'rxjs';
import { timeout } from 'rxjs/operators';
import { aFakeProvingProvider, initWalletWithSeed } from './utils.js';
import { PreprodConfig, UndeployedConfig } from './config.js';

/*
 * Dust sponsorship: fresh user wallet each run (example-counter style: random HD seed).
 * User never registers NIGHT UTXOs for dust generation — no dust accrual on the user;
 * sponsor pays dust fees only. Night is funded by sponsor, moved in the DApp-style tx,
 * then returned to the sponsor’s unshielded account via the prepared offer.
 *
 * 1. Transaction prepared outside (DApp-style)  2. user balances shielded + unshielded only
 * 3. sponsor adds dust, signs, submits.
 */

// const config = new PreprodConfig();
const config = new UndeployedConfig();

/** Well-funded sponsor (same family as genesis test wallets on local networks). */
const SPONSOR_SEED_HEX = '0000000000000000000000000000000000000000000000000000000000000002';

console.log('[1/6] Initializing wallets...');
const sponsor = await initWalletWithSeed(Buffer.from(SPONSOR_SEED_HEX, 'hex'), config);

const userSeed = Buffer.from(generateRandomSeed());
const user = await initWalletWithSeed(userSeed, config);
console.log('  User wallet seed (hex, new each run):', userSeed.toString('hex'));

const userAddress = user.unshieldedKeystore.getBech32Address().toString();
console.log('  User address:', userAddress);
const sponsorAddress = sponsor.unshieldedKeystore.getBech32Address().toString();
console.log('  Sponsor address:', sponsorAddress);


/** Night sent to the fresh user and routed back to the sponsor in the balanced tx (undeployed: small units; Preprod: use e.g. 1000n * 10n ** 6n). */
const nightAmountToSend = 10n;

const initialSenderState = await rx.firstValueFrom(
  sponsor.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);
const initialBalance = initialSenderState.unshielded.balances[ledger.nativeToken().raw] ?? 0n;

console.log(
  '  Sponsor initial balance:',
  initialSenderState.unshielded.balances[ledger.nativeToken().raw] ?? 0n,
);
const initialReceiverState = await rx.firstValueFrom(
  user.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);
const userInitialNight = initialReceiverState.unshielded.balances[ledger.nativeToken().raw] ?? 0n;
console.log('  User initial balance (expect 0 for a new seed):', userInitialNight);
if (userInitialNight !== 0n) {
  console.warn(
    '  Warning: user already had funds; for a strict empty-wallet demo use a network where this seed has never been funded.',
  );
}

console.log('[2/6] Sponsor sending Night to user...');
await sponsor.wallet
  .transferTransaction(
    [
      {
        type: 'unshielded',
        outputs: [
          {
            amount: nightAmountToSend,
            receiverAddress: user.unshieldedKeystore
              .getBech32Address()
              .decode(UnshieldedAddress, config.networkId),
            type: ledger.nativeToken().raw,
          },
        ],
      },
    ],
    {
      shieldedSecretKeys: sponsor.shieldedSecretKeys,
      dustSecretKey: sponsor.dustSecretKey,
    } ,
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

await rx.firstValueFrom(
  sponsor.wallet.state().pipe(
    rx.filter((s) => s.isSynced),
    rx.filter((s) => s.pending.all.length === 0),
  ),
);
console.log('[2/6] Sponsor funding tx settled (no pending).');

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
    config.networkId,
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
    transactionToBalance ,
    {
      shieldedSecretKeys: user.shieldedSecretKeys,
      dustSecretKey: user.dustSecretKey,
    } ,
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
    },
    {
      ttl: new Date(Date.now() + 30 * 60 * 1000),
      tokenKindsToBalance: ['dust'],
    },
  )
  .then((recipe) => sponsor.wallet.signRecipe(recipe, (payload) => sponsor.unshieldedKeystore.signData(payload)))
  .then((recipe) => sponsor.wallet.finalizeRecipe(recipe))
  .then((finalizedTransaction) => sponsor.wallet.submitTransaction(finalizedTransaction));
console.log('[5/6] Sponsor submitted transaction.');

console.log('[6/6] Waiting for sponsored tx to confirm, then reading balances...');
// submitTransaction returns before the chain/indexer reflect the spend; reading state too early
// shows the user still holding Night and the sponsor not yet refunded (see pending on sponsor).
await rx.firstValueFrom(
  sponsor.wallet.state().pipe(
    rx.filter((s) => s.isSynced),
    rx.filter((s) => s.pending.all.length === 0),
  ),
);
await rx.firstValueFrom(
  user.wallet.state().pipe(
    rx.filter((s) => s.isSynced),
    rx.filter((s) => (s.unshielded.balances[ledger.nativeToken().raw] ?? 0n) === 0n),
    timeout({ first: 120_000 }),
  ),
);

const finalSponsorState = await rx.firstValueFrom(
  sponsor.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);
const finalUserState = await rx.firstValueFrom(
  user.wallet.state().pipe(rx.filter((s) => s.isSynced)),
);

console.log('  Sponsor final balance:', finalSponsorState.unshielded.balances[ledger.nativeToken().raw] ?? 0n);
console.log('  User final balance:', finalUserState.unshielded.balances[ledger.nativeToken().raw] ?? 0n);


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
