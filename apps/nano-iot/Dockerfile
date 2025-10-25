FROM docker.io/node:22-alpine AS builder

WORKDIR /app
COPY . .
RUN npm ci --legacy-peer-deps
RUN npx nx build nano-iot

FROM docker.io/node:22-alpine

WORKDIR /app
COPY --from=builder /app/apps/nano-iot/dist ./
CMD ["node", "main.js"]
