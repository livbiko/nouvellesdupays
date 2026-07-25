FROM node:20-alpine AS build
WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json* ./apps/web/
WORKDIR /app/apps/web
RUN npm ci

WORKDIR /app
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
WORKDIR /app/apps/web
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
