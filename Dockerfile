FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run release:prepare && npm run db:generate

ENV NODE_ENV=production
EXPOSE 4321

CMD ["npm", "run", "start:prod"]
