FROM node:22-alpine AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Leave these empty for the usual setup: the console then talks to the API on
# port 4000 (and links to the player app on port 3000) of whatever host the
# browser loaded it from. Set them only when those are served from other
# origins (e.g. behind a reverse proxy). NEXT_PUBLIC_* values are inlined
# into the bundle at build time.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_PLAYER_APP_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PLAYER_APP_URL=$NEXT_PUBLIC_PLAYER_APP_URL
RUN npm run build


FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7662 \
    HOSTNAME=0.0.0.0

# output: "standalone" bundles the server and only the node_modules it uses.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 7662
CMD ["node", "server.js"]
