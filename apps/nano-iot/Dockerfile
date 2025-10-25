FROM docker.io/node:22-alpine AS builder

WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps --silent
RUN npx nx build nano-iot --prod
RUN npx nx prune nano-iot

FROM docker.io/node:22-alpine

WORKDIR /app
COPY --from=builder /app/apps/nano-iot/dist ./apps/nano-iot/dist
COPY --from=builder /app/libs/common/dist ./libs/common/dist
RUN npm install --only=production --silent
CMD ["node", "apps/nano-iot/dist/main.js"]
