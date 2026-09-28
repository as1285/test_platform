# 国内镜像加速（DaoCloud）；海外可改回 node:20-bookworm-slim
FROM docker.m.daocloud.io/library/node:20-bookworm-slim

WORKDIR /app

# 国内构建加速：Debian/PyPI/npm 走镜像
RUN set -eux; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
  elif [ -f /etc/apt/sources.list ]; then \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list; \
  fi; \
  apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    fonts-noto-cjk \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
  && pip3 install --break-system-packages --no-cache-dir \
    -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com \
    pymupdf \
    'qrcode[pil]' \
    fonttools \
    pillow \
    numpy \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm ci 偶发 Exit handler never called；失败回退 npm install，并校验关键依赖
RUN npm config set registry https://registry.npmmirror.com \
  && (npm ci --omit=dev || npm install --omit=dev --no-audit --no-fund) \
  && test -f node_modules/express/package.json \
  && test -f node_modules/mysql2/package.json \
  && test -f node_modules/jsonwebtoken/package.json

COPY server.js alipay.js register-guard.js mail.js serverMonitor.js purchaseUxMonitor.js dbLogRetention.js bank_card_bins.js opsStatsReport.js unusedActivationCodes.js ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY assets ./assets

# 启动关键根模块存在性校验，避免漏 COPY 导致容器重启风暴
RUN test -f /app/purchaseUxMonitor.js \
  && test -f /app/serverMonitor.js \
  && test -f /app/server.js

# 预抽取简体 Serif CJK，避免首份 PDF 冷启动抽字库过慢
RUN python3 /app/scripts/sbdy_extract_cjk_font.py \
      /usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc \
      /app/assets/sbdy/NotoSerifCJKsc-Regular.otf

ENV SBDY_PYTHON=python3

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
