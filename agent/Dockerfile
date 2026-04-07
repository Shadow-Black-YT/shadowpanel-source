FROM node:20-alpine
RUN apk add --no-cache python3 make g++ git curl
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
RUN npx tsc --outDir dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s CMD curl -f http://localhost:8080/health || exit 1
CMD ["node","dist/index.js"]
