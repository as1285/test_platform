# 构建阶段
FROM node:18-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY mine.html /usr/share/nginx/html/
COPY consult.html /usr/share/nginx/html/
COPY caidan /usr/share/nginx/html/caidan/
COPY grdb.jpg /usr/share/nginx/html/
COPY jtcy.jpg /usr/share/nginx/html/
COPY rzsp.jpg /usr/share/nginx/html/
COPY yhk.jpg /usr/share/nginx/html/
COPY nx.jpg /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css/
COPY js /usr/share/nginx/html/js/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]