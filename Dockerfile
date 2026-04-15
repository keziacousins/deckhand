FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/schema/package.json packages/schema/
COPY packages/sync/package.json packages/sync/
COPY packages/components/package.json packages/components/
COPY apps/editor/package.json apps/editor/
COPY apps/server/package.json apps/server/
RUN npm ci

COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/editor/ apps/editor/
COPY apps/server/ apps/server/

RUN npm run build -w packages/components && \
    npm run build -w apps/server && \
    npx vite build --outDir ../../dist/editor apps/editor

FROM node:22-alpine

RUN apk add --no-cache tini
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --workspace=apps/server

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/dist/editor dist/editor

ENV NODE_ENV=production
EXPOSE 3008

ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/server/dist/index.js"]
