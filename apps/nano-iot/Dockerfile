FROM docker.io/node:22-alpine

WORKDIR /app

COPY dist .

RUN npm --omit=dev -f install

CMD [ "node", "main.js" ]
