FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache docker-cli bash
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN addgroup -S runner && adduser -S runner -G runner
RUN chown -R runner:runner /app
USER runner
EXPOSE 5000
CMD ["npm", "start"]
