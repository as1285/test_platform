#!/usr/bin/env python3
"""Upload / prune MySQL dumps on Tencent COS (qcloud_cos)."""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone


def _must_env(name: str) -> str:
    val = str(os.environ.get(name) or "").strip()
    if not val:
        raise SystemExit("[cos] missing env %s" % name)
    return val


def _client():
    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError:
        raise SystemExit("[cos] 请先安装: pip3 install cos-python-sdk-v5")
    return CosS3Client(
        CosConfig(
            Region=_must_env("COS_REGION"),
            SecretId=_must_env("COS_SECRET_ID"),
            SecretKey=_must_env("COS_SECRET_KEY"),
            Scheme="https",
        )
    )


def _bucket() -> str:
    return _must_env("COS_BUCKET")


def object_key(name: str) -> str:
    prefix = str(os.environ.get("COS_PREFIX") or "").strip().strip("/")
    name = str(name or "").lstrip("/")
    if prefix:
        return prefix + "/" + name
    return name


def put_file(local_path: str, key: str) -> None:
    size = os.path.getsize(local_path)
    _client().upload_file(
        Bucket=_bucket(),
        LocalFilePath=local_path,
        Key=key,
        EnableMD5=True,
    )
    print("[cos] uploaded cos://%s/%s (%s bytes)" % (_bucket(), key, size))


def list_objects(prefix: str) -> list[tuple[str, datetime]]:
    client = _client()
    out = []
    marker = ""
    while True:
        resp = client.list_objects(Bucket=_bucket(), Prefix=prefix, Marker=marker, MaxKeys=1000)
        for item in resp.get("Contents") or []:
            key = str(item.get("Key") or "").strip()
            lm = str(item.get("LastModified") or "").strip()
            if not key or not lm:
                continue
            when = datetime.fromisoformat(lm.replace("Z", "+00:00"))
            out.append((key, when))
        if resp.get("IsTruncated") == "true" or resp.get("IsTruncated") is True:
            marker = str(resp.get("NextMarker") or "")
            if not marker:
                break
            continue
        break
    return out


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=_bucket(), Key=key)
    print("[cos] deleted %s" % key)


def prune_prefix(prefix: str, retain_days: int, keep_keys: set[str]) -> int:
    if retain_days <= 0:
        return 0
    cutoff = datetime.now(timezone.utc).timestamp() - retain_days * 86400
    removed = 0
    for key, when in list_objects(prefix):
        if key in keep_keys:
            continue
        if when.timestamp() >= cutoff:
            continue
        delete_object(key)
        removed += 1
    return removed


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: cos_put.py put <local> <object-name> | prune [retain-days] [keep-name...]", file=sys.stderr)
        return 2
    cmd = argv[1]
    if cmd == "put":
        local = argv[2]
        name = argv[3] if len(argv) > 3 else os.path.basename(local)
        put_file(local, object_key(name))
        return 0
    if cmd == "prune":
        days = int(argv[2]) if len(argv) > 2 else int(os.environ.get("COS_RETAIN_DAYS") or "30")
        keep_names = argv[3:]
        prefix = str(os.environ.get("COS_PREFIX") or "").strip().strip("/")
        list_prefix = (prefix + "/") if prefix else ""
        keep = {object_key(n) for n in keep_names}
        removed = prune_prefix(list_prefix, days, keep)
        print("[cos] pruned %s objects older than %s days" % (removed, days))
        return 0
    raise SystemExit("unknown command: %s" % cmd)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
