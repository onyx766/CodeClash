#!/bin/sh
# Container entrypoint for the CodeClash API.
#
#   RUN_MIGRATIONS=false  skip `prisma migrate deploy`
#   SEED_DATABASE=false   skip seeding (by default a database with no users
#                         gets the staff accounts and starter challenges;
#                         a database that already has users is left alone)
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Applying database migrations"
  node_modules/.bin/prisma migrate deploy
fi

if [ "${SEED_DATABASE:-true}" = "true" ]; then
  echo "[entrypoint] Seeding the database if it is empty"
  SEED_ONLY_IF_EMPTY=true node dist/prisma/seed.js
fi

exec "$@"
