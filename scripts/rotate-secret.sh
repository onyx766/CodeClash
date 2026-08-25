#!/usr/bin/env bash
# Rotate the runner_secret: create a new secret and remove the old one.
# Usage: ./scripts/rotate-secret.sh "new-secret-value"
set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"new-secret-value\""
  exit 1
fi
NEW="$1"
# create new secret with temp name
TMP_NAME=runner_secret_tmp_$(date +%s)
printf '%s' "$NEW" | docker secret create "$TMP_NAME" -
# update services that use the secret (requires swarm stack deploy in real setups)
# For local dev using docker compose, we'll remove old and rename new to runner_secret
if docker secret ls --format '{{.Name}}' | grep -q "^runner_secret$"; then
  docker secret rm runner_secret || true
fi
# there's no rename; create official name from tmp then remove tmp
printf '%s' "$NEW" | docker secret create runner_secret -
if docker secret ls --format '{{.Name}}' | grep -q "^$TMP_NAME$"; then
  docker secret rm "$TMP_NAME" || true
fi
echo "Rotated secret 'runner_secret'"
