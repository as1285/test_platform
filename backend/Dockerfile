FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
EXPOSE 3000
ENV DATA_FILE=/data/tax_data.json
CMD ["node", "server.js"]
