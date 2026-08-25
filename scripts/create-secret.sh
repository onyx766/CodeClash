#!/usr/bin/env bash
# Create Docker secret for local development (runner_secret)
# Usage: ./scripts/create-secret.sh "your-secret-value"
set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"secret-value\""
  exit 1
fi
SECRET="$1"
# initialize swarm if not already
if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then
  echo "Docker swarm not active. Initializing swarm (may require admin privileges)..."
  docker swarm init >/dev/null
fi
# remove existing secret if present
if docker secret ls --format '{{.Name}}' | grep -q "^runner_secret$"; then
  echo "Removing existing secret 'runner_secret'"
  docker secret rm runner_secret || true
fi
printf '%s' "$SECRET" | docker secret create runner_secret -
echo "Created secret 'runner_secret'"
