// Dust sponsorship flow matching docs-snippets/dust-sponsorship.ts
// Two wallets: sponsor (pays dust), user (balances tx without paying fees).
// Uses Preprod and fixed test seeds.

import * as ledger from '@midnight-ntwrk/ledger-v7';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as rx from 'rxjs';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import { PreprodConfig } from './config.js';

globalThis.WebSocket = WebSocket as any;

const SPONSOR_SEED = Buffer.from('5b598b6c31c6463c319c0258437ae003612739d308fd6d82c500a477a7d903d8', 'hex');
const USER_SEED = Buffer.from('fbeda6cd8f41ba22af745768cdf414f70b354323568d6118fe912a691a1f5cde', 'hex');

const TTL_MS = 30 * 60 * 1000;

async function initWalletWithSeed(
  seed: Buffer,
  config: PreprodConfig,
): Promise<{
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}> {
  const hdWallet = HDWallet.fromSeed(seed);
  if (hdWallet.type !== 'seedOk') throw new Error('Failed to initialize HDWallet');
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== 'keysDerived') throw new Error('Failed to derive keys');
  hdWallet.hdWallet.clear();

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(derivationResult.keys[Roles.NightExternal], getNetworkId());

  const relayURL = new URL(config.node.replace(/^http/, 'ws'));
  const provingServerUrl = new URL(config.proofServer);
  const indexerConnection = { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS };

  const shieldedWallet = ShieldedWallet({
    networkId: getNetworkId(),
    indexerClientConnection: indexerConnection,
    provingServerUrl,
    relayURL,
  }).startWithSecretKeys(shieldedSecretKeys);

  const unshieldedWallet = UnshieldedWallet({
    networkId: getNetworkId(),
    indexerClientConnection: indexerConnection,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

  const dustWallet = DustWallet({
    networkId: getNetworkId(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
    indexerClientConnection: indexerConnection,
    provingServerUrl,
    relayURL,
  } as any).startWithSecretKey(dustSecretKey as any, ledger.LedgerParameters.initialParameters().dust);

  const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await wallet.start(shieldedSecretKeys as any, dustSecretKey as any);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

const aFakeProvingProvider: ledger.ProvingProvider = {
  check: () => Promise.resolve([]),
  prove: () => Promise.resolve(new Uint8Array(0)),
};

async function main() {
  const config = new PreprodConfig();
  console.log('[1/8] Network:', getNetworkId());

  console.log('[2/8] Initializing sponsor wallet...');
  const sponsor = await initWalletWithSeed(SPONSOR_SEED, config);
  console.log('[2/8] Initializing user wallet...');
  const user = await initWalletWithSeed(USER_SEED, config);

  const nightAmountToSend = 10n;
  console.log('[3/8] Waiting for sponsor sync...');
  const initialSenderState = await rx.firstValueFrom(
    sponsor.wallet.state().pipe(rx.filter((s) => s.isSynced)),
  );
  const initialBalance = initialSenderState.unshielded.balances[ledger.nativeToken().raw] ?? 0n;
  console.log('[3/8] Sponsor initial unshielded balance:', initialBalance.toString());

  console.log('[4/8] Sponsor sending Night to user...');
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
      { ttl: new Date(Date.now() + TTL_MS) },
    )
    .then((recipe) => sponsor.wallet.signRecipe(recipe, (payload) => sponsor.unshieldedKeystore.signData(payload)))
    .then((recipe) => sponsor.wallet.finalizeRecipe(recipe))
    .then((tx) => sponsor.wallet.submitTransaction(tx));

  console.log('[4/8] Waiting for user to receive Night...');
  const userReceivedNight = await rx.firstValueFrom(
    user.wallet.state().pipe(
      rx.filter((state) => state.isSynced),
      rx.filter((state) => (state.unshielded.balances[ledger.nativeToken().raw] ?? 0n) > 0n),
    ),
  );
  console.log('[4/8] User received Night:', userReceivedNight.unshielded.balances[ledger.nativeToken().raw].toString());

  console.log('[5/8] Preparing transaction to balance (DApp-style, fake prover)...');
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
    const intent = ledger.Intent.new(new Date(Date.now() + TTL_MS));
    intent.fallibleUnshieldedOffer = unshieldedOffer;
    const unprovenTransaction = ledger.Transaction.fromParts(getNetworkId(), undefined, undefined, intent);
    return await unprovenTransaction.prove(
      aFakeProvingProvider,
      ledger.LedgerParameters.initialParameters().transactionCostModel.runtimeCostModel,
    );
  };

  const transactionToBalance = await prepareTransactionToBalance();
  console.log('[5/8] Transaction to balance prepared.');

  console.log('[6/8] User balancing tx (shielded + unshielded, no dust)...');
  const transactionWithoutFees = await user.wallet
    .balanceUnboundTransaction(
      transactionToBalance as any,
      {
        shieldedSecretKeys: user.shieldedSecretKeys,
        dustSecretKey: user.dustSecretKey,
      } as any,
      {
        ttl: new Date(Date.now() + TTL_MS),
        tokenKindsToBalance: ['shielded', 'unshielded'],
      },
    )
    .then((recipe) => user.wallet.signRecipe(recipe, (payload) => user.unshieldedKeystore.signData(payload)))
    .then((tx) => user.wallet.finalizeRecipe(tx));
  console.log('[6/8] User balance + sign + finalize done.');

  console.log('[7/8] Sponsor adding dust, signing, finalizing, submitting...');
  await sponsor.wallet
    .balanceFinalizedTransaction(
      transactionWithoutFees,
      {
        shieldedSecretKeys: sponsor.shieldedSecretKeys,
        dustSecretKey: sponsor.dustSecretKey,
      } as any,
      {
        ttl: new Date(Date.now() + TTL_MS),
        tokenKindsToBalance: ['dust'],
      },
    )
    .then((recipe) => sponsor.wallet.signRecipe(recipe, (payload) => sponsor.unshieldedKeystore.signData(payload)))
    .then((recipe) => sponsor.wallet.finalizeRecipe(recipe))
    .then((finalizedTransaction) => sponsor.wallet.submitTransaction(finalizedTransaction));
  console.log('[7/8] Sponsor submitted transaction.');

  console.log('[8/8] Reading final state...');
  const finalSponsorState = await rx.firstValueFrom(
    sponsor.wallet.state().pipe(rx.filter((s) => s.isSynced)),
  );
  const finalUserState = await rx.firstValueFrom(
    user.wallet.state().pipe(rx.filter((s) => s.isSynced)),
  );

  const finalSponsorBalance = finalSponsorState.unshielded.balances[ledger.nativeToken().raw] ?? 0n;
  const finalUserBalance = finalUserState.unshielded.balances[ledger.nativeToken().raw] ?? 0n;

  console.log('[8/8] Sponsored transfer completed.');
  console.log('  Sponsor final unshielded balance:', finalSponsorBalance.toString());
  console.log('  User final unshielded balance:', finalUserBalance.toString());
  console.log('  Sponsor received night back?', finalSponsorBalance === initialBalance);
  console.log('  User spent all Night?', finalUserBalance === 0n);

  await user.wallet.stop();
  await sponsor.wallet.stop();
  console.log('Wallets stopped.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
