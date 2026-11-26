FROM node:22-alpine

WORKDIR /app

# docker-cli: the worker drives the sandbox daemon (dind) through it.
# tini: reaps the docker CLI children and forwards signals.
RUN apk add --no-cache docker-cli tini

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

# Fixed uid/gid: the shared work volume is created owned by this user, and
# the dind service hands the volume to the same uid on start (see
# docker-compose.yml), whichever container happens to mount it first.
RUN addgroup -S -g 10001 runner \
 && adduser -S -u 10001 -G runner runner \
 && mkdir -p /work_shared \
 && chown runner:runner /work_shared

USER runner
EXPOSE 5000
ENTRYPOINT ["/sbin/tini", "--"]
# The queue worker runs from the same image: `node dist/worker/src/worker.js`.
CMD ["node", "dist/src/main.js"]
