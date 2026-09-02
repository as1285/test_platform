package com.testplatform.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * App 壳内保存证明文件到系统「下载 / 相册」。
 * H5 可通过 TaxNativeSave.saveBase64，或触发 HTTPS 附件下载走 DownloadListener。
 */
public class TaxFileBridge {
    private final Activity activity;

    public TaxFileBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String saveBase64(String filename, String mime, String base64) {
        try {
            if (base64 == null || base64.length() == 0) {
                return "err:empty";
            }
            /* Binder 事务约 1MB，超大文件改走 HTTPS 下载 */
            if (base64.length() > 900000) {
                return "err:too_large";
            }
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            String name = sanitizeName(filename);
            String m = (mime == null || mime.length() == 0) ? "application/octet-stream" : mime;
            Uri uri = writeMediaStore(activity, name, m, data);
            if (uri == null) {
                return "err:write";
            }
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity, "已保存到手机：" + name, Toast.LENGTH_SHORT).show();
                }
            });
            return "ok:" + uri.toString();
        } catch (Exception e) {
            return "err:" + (e.getMessage() != null ? e.getMessage() : "fail");
        }
    }

    public static void enqueueDownload(
        final Activity activity,
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType
    ) {
        if (activity == null || url == null) {
            return;
        }
        if (!url.startsWith("https://") && !url.startsWith("http://")) {
            return;
        }
        try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            if (mimeType != null && mimeType.length() > 0) {
                req.setMimeType(mimeType);
            }
            final String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            req.setTitle(name);
            req.setDescription("保存证明文件");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            if (userAgent != null && userAgent.length() > 0) {
                req.addRequestHeader("User-Agent", userAgent);
            }
            DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) {
                throw new IllegalStateException("no download manager");
            }
            dm.enqueue(req);
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity, "已开始下载到「下载」目录", Toast.LENGTH_SHORT).show();
                }
            });
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception ignored) {
            }
        }
    }

    private static String sanitizeName(String filename) {
        String raw = filename == null ? "file.bin" : filename.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        raw = raw.replace("..", "_").trim();
        if (raw.length() > 120) {
            raw = raw.substring(raw.length() - 120);
        }
        if (raw.length() == 0) {
            return "cert.bin";
        }
        return raw;
    }

    private static Uri writeMediaStore(Context ctx, String name, String mime, byte[] data) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            Uri collection;
            if (mime.startsWith("image/")) {
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/LizhiCert");
                collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            } else {
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            }
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = ctx.getContentResolver().insert(collection, values);
            if (uri == null) {
                return null;
            }
            OutputStream os = ctx.getContentResolver().openOutputStream(uri);
            if (os == null) {
                return null;
            }
            try {
                os.write(data);
            } finally {
                os.close();
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            ctx.getContentResolver().update(uri, values, null, null);
            return uri;
        }
        File dir = Environment.getExternalStoragePublicDirectory(
            mime.startsWith("image/") ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS
        );
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("mkdir");
        }
        File out = new File(dir, name);
        FileOutputStream fos = new FileOutputStream(out);
        try {
            fos.write(data);
        } finally {
            fos.close();
        }
        return Uri.fromFile(out);
    }
}
