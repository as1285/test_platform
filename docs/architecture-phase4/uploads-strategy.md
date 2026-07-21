# Uploads 存储策略

> 阶段 4 · 2026-07-21

## 现状（生产 Compose）

| 项 | 值 |
|----|-----|
| 写入 | 后端 `UPLOAD_DIR=/data/uploads`（multer） |
| 卷 | `uploads_static` → backend `/data/uploads` + frontend nginx `/usr/share/nginx/html/uploads` |
| 对外 URL | `https://geshui.vip/uploads/<file>` |
| DB 存值 | 相对路径 `uploads/<hex>.<ext>`（可移植） |
| 后端 | `UPLOAD_STORAGE_BACKEND=local`（默认） |

nginx：`/uploads/` 限流 + 长缓存；APK 强制附件下载。

## CDN / 对象存储演进（未改写入路径）

1. 设置 `PUBLIC_ASSET_BASE_URL=https://cdn.example.com`（无尾斜杠）。
2. `resolvePublicAssetUrl()` 将 `uploads/…` 解析为 `https://cdn.example.com/uploads/…`。
3. 用同步/回源把本地卷镜像到对象存储或 CDN；**库内仍存相对路径**。
4. 将来 `UPLOAD_STORAGE_BACKEND=s3|oss` 再换写入实现；现仅日志提示非 local。

## 边界与后续

- 未做：对象元数据表、未引用文件 GC、上传大小硬限制（nginx 当前 `client_max_body_size 0`）。
- 建议后续：按类型限制体积；孤儿文件清理；杀毒可选。
