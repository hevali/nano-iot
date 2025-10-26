FROM docker.io/node:22-alpine AS builder

WORKDIR /app

COPY . .

RUN npm install --legacy-peer-deps --silent
RUN npx nx build nano-iot --prod

FROM docker.io/node:22-alpine

WORKDIR /app

COPY --from=builder /app/apps/nano-iot/dist ./apps/nano-iot/dist
RUN cd ./apps/nano-iot/dist && npm install --only=production --silent

COPY --from=builder /app/libs/common/dist ./libs/common/dist
COPY --from=builder /app/libs/common/package.json ./libs/common

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm install --only=production --silent

CMD ["node", "apps/nano-iot/dist/main.js"]
