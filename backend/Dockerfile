FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --registry=https://registry.npmmirror.com
COPY server.js alipay.js chatAi.js register-guard.js mail.js serverMonitor.js dbLogRetention.js bank_card_bins.js ./
COPY src ./src
COPY migrations ./migrations
EXPOSE 3000
CMD ["node", "server.js"]
