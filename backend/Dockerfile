FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js register-guard.js mail.js serverMonitor.js bank_card_bins.js ./
EXPOSE 3000
CMD ["node", "server.js"]
