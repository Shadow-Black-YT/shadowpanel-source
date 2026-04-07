FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache python3 make g++ git curl
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm rebuild node-pty
COPY --from=builder /app/dist ./dist
RUN mkdir -p logs
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD curl -f http://localhost:5000/health || exit 1
CMD ["node", "dist/index.js"]
