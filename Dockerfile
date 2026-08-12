FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","--require","./reset-preload.js","server.js"]
