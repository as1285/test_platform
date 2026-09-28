# Playwright 前端冒烟镜像（内置 Chromium，无需宿主机安装浏览器）
# 构建: ./scripts/docker/ui-smoke/build-image.sh
ARG PLAYWRIGHT_BASE=mcr.microsoft.com/playwright:v1.52.0-jammy
FROM ${PLAYWRIGHT_BASE}

WORKDIR /work

# 仅安装跑冒烟所需依赖（镜像内已含浏览器）
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci 2>/dev/null || (cd frontend && npm install playwright@^1.52.0)

COPY frontend/tests/e2e/ui-smoke-browser.mjs ./frontend/tests/e2e/ui-smoke-browser.mjs
COPY scripts/docker/ui-smoke/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENTRYPOINT ["/entrypoint.sh"]
