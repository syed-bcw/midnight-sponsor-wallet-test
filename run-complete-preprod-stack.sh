#!/usr/bin/env bash
set -euo pipefail

# Full local stack for Midnight preprod:
# - postgres (db-sync DB)
# - cardano-node (preprod)
# - cardano-db-sync (preprod)
# - midnight-node (preprod, Ariadne mode)

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-cardano-postgres-preprod}"
CARDANO_NODE_CONTAINER="${CARDANO_NODE_CONTAINER:-cardano-node-preprod}"
DBSYNC_CONTAINER="${DBSYNC_CONTAINER:-cardano-db-sync-preprod}"
MIDNIGHT_CONTAINER="${MIDNIGHT_CONTAINER:-midnight-rpc-node-preprod}"

POSTGRES_DB="${POSTGRES_DB:-cexplorer}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
EXPOSE_POSTGRES_PORT="${EXPOSE_POSTGRES_PORT:-false}"

NETWORK_NAME="${NETWORK_NAME:-preprod-stack-net}"
DBSYNC_WAIT_SECONDS="${DBSYNC_WAIT_SECONDS:-600}"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-7200}"
READY_POLL_SECONDS="${READY_POLL_SECONDS:-15}"
FOLLOW_LOGS="${FOLLOW_LOGS:-true}"
RESTORE_SNAPSHOT="${RESTORE_SNAPSHOT:-}"

MIDNIGHT_DB_CONN="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_CONTAINER}:${POSTGRES_PORT}/${POSTGRES_DB}"

usage() {
  cat <<'EOF'
Usage:
  ./run-complete-preprod-stack.sh up      # start full stack
  ./run-complete-preprod-stack.sh down    # stop and remove stack containers
  ./run-complete-preprod-stack.sh status  # show container status
  ./run-complete-preprod-stack.sh logs    # tail logs for all stack containers
  ./run-complete-preprod-stack.sh progress # show db-sync/midnight progress
  ./run-complete-preprod-stack.sh wait-ready # wait until Midnight imports blocks

Environment knobs:
  FOLLOW_LOGS=true|false
  READY_TIMEOUT_SECONDS=7200
  READY_POLL_SECONDS=15
  RESTORE_SNAPSHOT=https://.../snapshot.tar.zst
EOF
}

remove_container_if_exists() {
  local name="$1"
  docker rm -f "$name" >/dev/null 2>&1 || true
}

wait_for_postgres() {
  local deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Timed out waiting for postgres to become ready."
  return 1
}

wait_for_dbsync_schema() {
  local deadline=$((SECONDS + DBSYNC_WAIT_SECONDS))
  while (( SECONDS < deadline )); do
    # We wait for a core db-sync table so Midnight won't crash on missing relations.
    local has_table
    has_table="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT to_regclass('public.ma_tx_out') IS NOT NULL;" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ "$has_table" == "t" ]]; then
      return 0
    fi
    sleep 5
  done
  echo "Timed out waiting for cardano-db-sync schema (table ma_tx_out) to appear."
  return 1
}

require_container_running() {
  local name="$1"
  if ! docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null | tr -d '\r' | grep -q '^true$'; then
    echo "Container is not running: $name"
    return 1
  fi
}

print_progress() {
  local db_tip
  local midnight_best
  db_tip="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select coalesce(max(block_no),0), coalesce(max(slot_no),0) from block;" 2>/dev/null | tr -d '[:space:]' || true)"
  midnight_best="$(docker logs --tail 120 "$MIDNIGHT_CONTAINER" 2>/dev/null | sed -n 's/.*best: #\([0-9][0-9]*\).*/\1/p' | tail -n 1)"
  if [[ -z "$midnight_best" ]]; then
    midnight_best=0
  fi
  echo "db-sync(max_block,max_slot)=${db_tip:-unknown} | midnight(best_block)=$midnight_best"
}

wait_for_midnight_ready() {
  local deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
  echo "Waiting for Midnight readiness (best block > 0)..."
  while (( SECONDS < deadline )); do
    require_container_running "$MIDNIGHT_CONTAINER" || return 1
    require_container_running "$DBSYNC_CONTAINER" || return 1
    print_progress
    local midnight_best
    midnight_best="$(docker logs --tail 160 "$MIDNIGHT_CONTAINER" 2>/dev/null | sed -n 's/.*best: #\([0-9][0-9]*\).*/\1/p' | tail -n 1)"
    if [[ -n "$midnight_best" && "$midnight_best" -gt 0 ]]; then
      echo "Midnight is ready (best block: $midnight_best)."
      return 0
    fi
    sleep "$READY_POLL_SECONDS"
  done
  echo "Timed out waiting for Midnight readiness."
  return 1
}

start_stack() {
  docker network create "$NETWORK_NAME" >/dev/null 2>&1 || true

  remove_container_if_exists "$MIDNIGHT_CONTAINER"
  remove_container_if_exists "$DBSYNC_CONTAINER"
  remove_container_if_exists "$CARDANO_NODE_CONTAINER"
  remove_container_if_exists "$POSTGRES_CONTAINER"

  local postgres_port_flags=()
  local dbsync_snapshot_flags=()
  if [[ "$EXPOSE_POSTGRES_PORT" == "true" ]]; then
    postgres_port_flags=(-p "${POSTGRES_PORT}:5432")
  fi
  if [[ -n "$RESTORE_SNAPSHOT" ]]; then
    dbsync_snapshot_flags=(-e "RESTORE_SNAPSHOT=${RESTORE_SNAPSHOT}")
  fi

  docker run -d \
    --name "$POSTGRES_CONTAINER" \
    --network "$NETWORK_NAME" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    "${postgres_port_flags[@]}" \
    postgres:16 >/dev/null

  wait_for_postgres

  docker run -d \
    --name "$CARDANO_NODE_CONTAINER" \
    --network "$NETWORK_NAME" \
    -e NETWORK=preprod \
    -v cardano-node-preprod-ipc:/ipc \
    -v cardano-node-preprod-data:/data \
    ghcr.io/intersectmbo/cardano-node:10.4.1 >/dev/null

  docker run -d \
    --name "$DBSYNC_CONTAINER" \
    --network "$NETWORK_NAME" \
    -e NETWORK=preprod \
    -e POSTGRES_HOST="$POSTGRES_CONTAINER" \
    -e POSTGRES_PORT=5432 \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    "${dbsync_snapshot_flags[@]}" \
    -v cardano-node-preprod-ipc:/node-ipc \
    -v cardano-db-sync-preprod:/var/lib/cexplorer \
    ghcr.io/intersectmbo/cardano-db-sync:13.6.0.5 >/dev/null

  wait_for_dbsync_schema

  docker run -d \
    --name "$MIDNIGHT_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p 9944:9944 -p 30333:30333 \
    -v midnight-data:/node \
    -e DB_SYNC_POSTGRES_CONNECTION_STRING="$MIDNIGHT_DB_CONN" \
    -e ALLOW_NON_SSL=true \
    -e CARDANO_SECURITY_PARAMETER=2160 \
    -e CARDANO_ACTIVE_SLOTS_COEFF=0.05 \
    midnightntwrk/midnight-node:0.22.2 \
    --chain=/res/preprod/chain-spec-raw.json \
    --rpc-methods=Safe \
    --rpc-cors=all \
    --rpc-external >/dev/null

  echo "Stack started:"
  echo "  postgres      : $POSTGRES_CONTAINER"
  echo "  cardano-node  : $CARDANO_NODE_CONTAINER"
  echo "  cardano-db-sync: $DBSYNC_CONTAINER"
  echo "  midnight-node : $MIDNIGHT_CONTAINER"
  echo
  if [[ "$FOLLOW_LOGS" == "true" ]]; then
    echo
    echo "Tailing midnight logs (Ctrl+C to stop tail; containers keep running)..."
    docker logs -f "$MIDNIGHT_CONTAINER"
  fi
}

down_stack() {
  remove_container_if_exists "$MIDNIGHT_CONTAINER"
  remove_container_if_exists "$DBSYNC_CONTAINER"
  remove_container_if_exists "$CARDANO_NODE_CONTAINER"
  remove_container_if_exists "$POSTGRES_CONTAINER"
  docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
  echo "Stack removed."
}

status_stack() {
  docker ps -a --filter "name=${POSTGRES_CONTAINER}" --filter "name=${CARDANO_NODE_CONTAINER}" --filter "name=${DBSYNC_CONTAINER}" --filter "name=${MIDNIGHT_CONTAINER}"
}

logs_stack() {
  docker logs --tail 80 "$POSTGRES_CONTAINER" 2>/dev/null || true
  docker logs --tail 80 "$CARDANO_NODE_CONTAINER" 2>/dev/null || true
  docker logs --tail 80 "$DBSYNC_CONTAINER" 2>/dev/null || true
  docker logs --tail 80 "$MIDNIGHT_CONTAINER" 2>/dev/null || true
}

progress_stack() {
  require_container_running "$POSTGRES_CONTAINER" || return 1
  require_container_running "$MIDNIGHT_CONTAINER" || return 1
  print_progress
}

cmd="${1:-up}"
case "$cmd" in
  up) start_stack ;;
  down) down_stack ;;
  status) status_stack ;;
  logs) logs_stack ;;
  progress) progress_stack ;;
  wait-ready) wait_for_midnight_ready ;;
  *) usage; exit 1 ;;
esac
