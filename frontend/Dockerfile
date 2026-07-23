# 构建阶段：Vite 产物 + 组装带 content-hash 的静态站点
FROM node:18-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
  && sed -i 's|http://mirrors.tencentyun.com/npm/|https://registry.npmmirror.com/|g' package-lock.json \
  && sed -i 's|https://registry.npmjs.org/|https://registry.npmmirror.com/|g' package-lock.json \
  && npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 生产阶段：整站一次性拷贝（阶段 3 收拢百余条 COPY）
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /app/site/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY blocked_ips.conf /etc/nginx/blocked_ips.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
