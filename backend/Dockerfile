FROM node:22-alpine AS build

WORKDIR /app
# Prisma's query and schema engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN node_modules/.bin/prisma generate \
 && npm run build \
 && npm prune --omit=dev --no-audit --no-fund


FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
