FROM docker.io/node:22-alpine AS builder

WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
RUN npx nx build nano-iot

FROM docker.io/node:22-alpine

WORKDIR /app
COPY --from=builder /app/apps/nano-iot/dist ./
RUN npm install --only=production --silent
CMD ["node", "main.js"]
