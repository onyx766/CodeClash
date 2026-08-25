#!/usr/bin/env bash
# Remove Docker secret 'runner_secret'
set -euo pipefail
if docker secret ls --format '{{.Name}}' | grep -q "^runner_secret$"; then
  echo "Removing secret 'runner_secret'"
  docker secret rm runner_secret || true
else
  echo "Secret 'runner_secret' not found"
fi
