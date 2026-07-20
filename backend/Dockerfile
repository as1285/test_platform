FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js alipay.js register-guard.js mail.js serverMonitor.js dbLogRetention.js bank_card_bins.js ./
EXPOSE 3000
CMD ["node", "server.js"]
