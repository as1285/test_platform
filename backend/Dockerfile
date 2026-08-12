FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    fonts-noto-cjk \
    openssh-client \
    sshpass \
  && pip3 install --break-system-packages --no-cache-dir \
    pymupdf \
    'qrcode[pil]' \
    fonttools \
    pillow \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --registry=https://registry.npmmirror.com

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

EXPOSE 3000
CMD ["node", "server.js"]
