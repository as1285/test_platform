FROM node:20-bookworm-slim

WORKDIR /app

# 国内构建加速：Debian/PyPI 走镜像，避免 deb.debian.org 过慢导致部署卡住
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
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com

COPY server.js alipay.js chatAi.js register-guard.js mail.js serverMonitor.js dbLogRetention.js bank_card_bins.js ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY assets ./assets

# 预抽取简体 Serif CJK，避免首份 PDF 冷启动抽字库过慢
RUN python3 /app/scripts/sbdy_extract_cjk_font.py \
      /usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc \
      /app/assets/sbdy/NotoSerifCJKsc-Regular.otf

ENV SBDY_PYTHON=python3

# 说明：运行时 /data/uploads 为命名卷，默认 root 可写；若改 USER node 需先 chown 卷
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]