FROM node:18-alpine

WORKDIR /app

# Backend
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# Migrations
RUN npm run migrate || true
RUN npm run seed || true

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
