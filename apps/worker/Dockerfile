FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN npm ci --omit=dev --workspace=apps/worker --workspace=packages/shared

COPY packages/shared packages/shared
COPY apps/worker apps/worker

USER node
CMD ["node", "apps/worker/src/poll-once.js"]
