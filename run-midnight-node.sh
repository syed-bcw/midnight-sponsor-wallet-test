#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="midnight-rpc-node-preprod"

if [[ -z "${DB_SYNC_POSTGRES_CONNECTION_STRING:-}" ]]; then
  echo "Missing DB_SYNC_POSTGRES_CONNECTION_STRING."
  echo "A preprod node on v0.22.2 requires Ariadne (db-sync) and will not sync correctly with mock registrations."
  echo
  echo "Example:"
  echo "  export DB_SYNC_POSTGRES_CONNECTION_STRING='postgres://user:pass@host:5432/cexplorer'"
  echo "  export ALLOW_NON_SSL=true   # required if DB endpoint has no TLS"
  exit 1
fi

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run \
  --name "$CONTAINER_NAME" \
  -p 9944:9944 -p 30333:30333 \
  -v midnight-data:/node \
  -e DB_SYNC_POSTGRES_CONNECTION_STRING="$DB_SYNC_POSTGRES_CONNECTION_STRING" \
  -e ALLOW_NON_SSL="${ALLOW_NON_SSL:-true}" \
  midnightntwrk/midnight-node:0.22.2 \
  --chain=/res/preprod/chain-spec-raw.json \
  --rpc-methods=Safe \
  --rpc-cors=all \
  --rpc-external