FROM docker.io/node:22-alpine AS builder

ARG BUILD_FLAG

WORKDIR /app/builder

COPY . .
RUN npx nx build nano-iot ${BUILD_FLAG}

FROM docker.io/node:22-alpine

ARG NODE_ENV

WORKDIR /app

COPY --from=builder /app/builder/apps/nano-iot/dist ./

ENV NODE_ENV=$NODE_ENV

CMD ["node", "main.js"]
