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
import type { Config } from './config.js';

export async function initWalletWithSeed(
  seed: Buffer,
  config: Config,
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
  } as any).startWithSecretKeys(shieldedSecretKeys as any);

  const unshieldedWallet = UnshieldedWallet({
    networkId: getNetworkId(),
    indexerClientConnection: indexerConnection,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  } as any).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

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

export const aFakeProvingProvider: ledger.ProvingProvider = {
  check: () => Promise.resolve([]),
  prove: () => Promise.resolve(new Uint8Array(0)),
};
