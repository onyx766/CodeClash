#!/usr/bin/env sh
# Creates ./.env for docker compose from .env.example, filling every secret
# with a freshly generated random value.
#
# Usage: ./scripts/init-env.sh [--force]
#   --force  overwrite an existing .env (all secrets change; existing sessions
#            are invalidated and the database password no longer matches an
#            existing postgres volume)
set -eu

cd "$(dirname "$0")/.."

if [ -f .env ] && [ "${1:-}" != "--force" ]; then
  echo ".env already exists - leaving it untouched (use --force to regenerate)." >&2
  exit 1
fi

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
  fi
}

admin_password="$(random_hex 9)"
player_password="$(random_hex 6)"

sed \
  -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(random_hex 32)|" \
  -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(random_hex 32)|" \
  -e "s|^RUNNER_SECRET=.*|RUNNER_SECRET=$(random_hex 32)|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(random_hex 24)|" \
  -e "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=${admin_password}|" \
  -e "s|^SEED_PLAYER_PASSWORD=.*|SEED_PLAYER_PASSWORD=${player_password}|" \
  .env.example > .env
chmod 600 .env

cat <<EOF
Wrote .env with generated secrets.

Accounts created on first start:
  admin@codeclash.local / master@codeclash.local   password: ${admin_password}
  player1..5@codeclash.local                        password: ${player_password}
(also stored in .env as SEED_ADMIN_PASSWORD / SEED_PLAYER_PASSWORD)

Next: docker compose up --build -d
EOF
