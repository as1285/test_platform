# 构建阶段
FROM node:18-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY mine.html /usr/share/nginx/html/
COPY consult.html /usr/share/nginx/html/
COPY shouye.html /usr/share/nginx/html/
COPY shuiming.html /usr/share/nginx/html/
COPY shuiming_result.html /usr/share/nginx/html/
COPY xiangqing.html /usr/share/nginx/html/
COPY shuikuanjisuan.html /usr/share/nginx/html/
COPY daiban.html /usr/share/nginx/html/
COPY bancha.html /usr/share/nginx/html/
COPY message.html /usr/share/nginx/html/
COPY register.html /usr/share/nginx/html/
COPY activate.html /usr/share/nginx/html/
COPY admin_login.html /usr/share/nginx/html/
COPY admin_panel.html /usr/share/nginx/html/
COPY profile.html /usr/share/nginx/html/
COPY zonghe.html /usr/share/nginx/html/
COPY najilu.html /usr/share/nginx/html/
COPY renzhi.html /usr/share/nginx/html/
COPY renzhi_detail.html /usr/share/nginx/html/
COPY index.html /usr/share/nginx/html/index.html
COPY index.html /usr/share/nginx/html/login.html
COPY caidan /usr/share/nginx/html/caidan/
COPY erji.jpg /usr/share/nginx/html/
COPY hk.jpg /usr/share/nginx/html/
COPY grdb.jpg /usr/share/nginx/html/
COPY jtcy.jpg /usr/share/nginx/html/
COPY rzsp.jpg /usr/share/nginx/html/
COPY yhk.jpg /usr/share/nginx/html/
COPY nx.jpg /usr/share/nginx/html/
COPY lb.jpg /usr/share/nginx/html/
COPY ld.png /usr/share/nginx/html/
COPY jt.png /usr/share/nginx/html/
COPY sydb.jpg /usr/share/nginx/html/
COPY zdb.jpg /usr/share/nginx/html/
COPY zdfwdb.jpg /usr/share/nginx/html/
COPY daiban.jpg /usr/share/nginx/html/
COPY bs.jpg /usr/share/nginx/html/
COPY cx.jpg /usr/share/nginx/html/
COPY db.jpg /usr/share/nginx/html/
COPY fp.jpg /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css/
COPY public/js /usr/share/nginx/html/js/
COPY app-debug.apk /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]