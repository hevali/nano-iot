FROM docker.io/node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json tsconfig.base.json nx.json ./
COPY apps/ ./apps
COPY libs/ ./libs

RUN npm install --legacy-peer-deps --silent
RUN npx nx build docs

FROM nginx:1.29-alpine

RUN mkdir /app

COPY --from=builder /app/apps/docs/dist /app
COPY apps/docs/nginx.conf /etc/nginx/nginx.conf
COPY apps/docs/docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["nginx", "-g", "daemon off;"]
