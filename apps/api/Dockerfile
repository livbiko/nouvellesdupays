FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace=apps/api --workspace=packages/shared

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY db db

USER node
EXPOSE 4000
CMD ["node", "apps/api/src/index.js"]
