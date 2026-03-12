import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export interface Config {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

const PROOF_SERVER_URL_POSTFIX = '/midnight/zkpaas/testnet/46634Y77zrsb1294Z72h9P02MN43d4N4/';

export class PreprodConfig implements Config {
  indexer = 'https://indexer.preprod.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preprod.midnight.network';
  // proofServer = 'https://starter.qa.arkhia.network' + PROOF_SERVER_URL_POSTFIX;
  proofServer = 'http://127.0.0.1:6300';

  constructor() {
    setNetworkId('preprod');
  }
}
