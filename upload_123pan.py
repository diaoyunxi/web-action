#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""123云盘上传脚本 v4 - Android 客户端协议 + s3_list_upload_parts 初始化
关键修复: 在获取预签名URL前先调用 s3_list_upload_parts 初始化 multipart session"""

import os
import sys
import time
import hashlib
import json
import requests

PASSPORT = "17345783878"
PASSWORD = "Hy123456"

CHUNK_SIZE = 5 * 1024 * 1024  # 5MB

UPLOAD_FILES = [
    ("/tmp/release/web-action-2.2.0.zip", "2.2.0.zip"),
    ("/tmp/release/web-action-2.2.0+releases.zip", "2.2.0+releases.zip"),
]

REMOTE_PATH = "/github/web-action"


def make_headers(token=None):
    """Android 客户端 headers"""
    ret = {
        "user-agent": "123pan/v2.4.0(Android_11;Xiaomi)",
        "content-type": "application/json",
        "platform": "android",
        "devicetype": "M2004J19C",
        "osversion": "Android_11",
        "app-version": "61",
        "x-app-version": "2.4.0",
    }
    if token:
        ret["authorization"] = f"Bearer {token}"
    return ret


def login():
    resp = requests.post("https://login.123pan.com/api/user/sign_in",
                         headers=make_headers(),
                         json={"passport": PASSPORT, "password": PASSWORD, "remember": True},
                         timeout=30)
    result = resp.json()
    if result.get("code") in (0, 200):
        print("[OK] 登录成功")
        return result["data"]["token"]
    print(f"[FAIL] 登录失败: {result}")
    sys.exit(1)


def get_file_list(token, parent_id=0):
    url = "https://123pan.com/b/api/file/list/new"
    params = {"driveId": 0, "limit": 100, "next": 0, "orderBy": "file_id",
              "orderDirection": "asc", "parentFileId": parent_id,
              "trashed": False, "SearchData": ""}
    resp = requests.get(url, headers=make_headers(token), params=params, timeout=30)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            return result.get("data", {}).get("InfoList", [])
    return []


def find_or_create_folder(token, path):
    parts = [p for p in path.strip("/").split("/") if p]
    current_parent = 0
    for part in parts:
        files = get_file_list(token, current_parent)
        found = None
        for f in files:
            if f.get("Type") == 1 and f.get("FileName") == part:
                found = f
                break
        if found:
            current_parent = found["FileId"]
            print(f"[OK] 找到文件夹: {part} (id={current_parent})")
        else:
            current_parent = create_folder(token, part, current_parent)
            print(f"[OK] 创建文件夹: {part} (id={current_parent})")
    return current_parent


def create_folder(token, name, parent_id=0):
    url = "https://123pan.com/a/api/file/upload_request"
    data = {"driveId": 0, "etag": "", "fileName": name, "parentFileId": parent_id,
            "size": 0, "Type": 1, "fileType": 1, "NotReuse": True}
    resp = requests.post(url, headers=make_headers(token), json=data, timeout=30)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            info = result.get("data", {}).get("Info", {})
            file_id = info.get("FileId") if isinstance(info, dict) else None
            if file_id:
                return file_id
            files = get_file_list(token, parent_id)
            for f in files:
                if f.get("Type") == 1 and f.get("FileName") == name:
                    return f["FileId"]
    print(f"[FAIL] 创建文件夹失败: {resp.text[:200]}")
    sys.exit(1)


def calc_md5(filepath):
    md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()


def upload_request(token, filepath, file_name, parent_id):
    """返回 dict(需上传)/'instant'(秒传)/None(失败)"""
    url = "https://123pan.com/b/api/file/upload_request"
    size = os.path.getsize(filepath)
    md5 = calc_md5(filepath)
    data = {"driveId": 0, "duplicate": 2, "etag": md5, "fileName": file_name,
            "parentFileId": parent_id, "size": size, "Type": 0,
            "fileType": 0, "NotReuse": True, "Reuse": False}
    resp = requests.post(url, headers=make_headers(token), json=data, timeout=30)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            data_obj = result.get("data", {})
            if data_obj.get("Reuse") or data_obj.get("SpeedUp") or data_obj.get("speedUp"):
                return "instant"
            print(f"[OK] 上传请求成功 (UploadId={data_obj.get('UploadId')})")
            return data_obj
    print(f"[FAIL] 上传请求失败: {resp.text[:200]}")
    return None


def s3_list_upload_parts(token, bucket, key, upload_id):
    """关键: 初始化 multipart upload session"""
    url = "https://123pan.com/b/api/file/s3_list_upload_parts"
    data = {"bucket": bucket, "key": key, "uploadId": upload_id}
    resp = requests.post(url, headers=make_headers(token), json=data, timeout=30)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            print("[OK] s3_list_upload_parts (初始化 multipart session)")
            return True
        print(f"[WARN] s3_list_upload_parts: {result}")
    else:
        print(f"[WARN] s3_list_upload_parts 失败: {resp.status_code}")
    return False


def s3_repare_upload_parts_batch(token, bucket, key, upload_id, chunk_count, file_id=None):
    url = "https://123pan.com/b/api/file/s3_repare_upload_parts_batch"
    request_end = max(chunk_count + 1, 2)
    data = {"bucket": bucket, "key": key, "partNumberStart": 1,
            "partNumberEnd": request_end, "uploadId": upload_id, "readOnly": False}
    params = {"fileId": file_id} if file_id else {}
    resp = requests.post(url, headers=make_headers(token), json=data, params=params, timeout=30)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            presigned = result.get("data", {}).get("presignedUrls", {}) or {}
            if presigned:
                print(f"[OK] 获取到 {len(presigned)} 个预签名URL")
                return presigned
    print(f"[FAIL] 获取预签名URL失败: {resp.text[:200]}")
    return {}


def upload_file_presigned(token, upload_data, filepath):
    bucket = upload_data.get("Bucket")
    key = upload_data.get("Key")
    upload_id = upload_data.get("UploadId")
    file_id = upload_data.get("FileId")

    # 关键: 先调用 s3_list_upload_parts 初始化 multipart session
    s3_list_upload_parts(token, bucket, key, upload_id)

    size = os.path.getsize(filepath)
    chunk_count = max(1, (size + CHUNK_SIZE - 1) // CHUNK_SIZE)

    presigned_urls = s3_repare_upload_parts_batch(token, bucket, key, upload_id, chunk_count, file_id)
    if not presigned_urls:
        return None

    parts_info = []
    with open(filepath, "rb") as f:
        for part_num in range(1, chunk_count + 1):
            chunk_data = f.read(CHUNK_SIZE)
            upload_url = presigned_urls.get(str(part_num)) or presigned_urls.get(part_num)
            if not upload_url:
                print(f"[FAIL] 分块 {part_num} 无预签名URL")
                return None
            print(f"  [上传] 分块 {part_num}/{chunk_count} ({len(chunk_data)} bytes)...")
            put_resp = requests.put(upload_url, data=chunk_data, timeout=120)
            if put_resp.status_code in (200, 204):
                etag = put_resp.headers.get("ETag", "").strip('"')
                parts_info.append({"PartNumber": part_num, "ETag": etag})
                print(f"  [OK] 分块 {part_num} 上传成功 (ETag={etag})")
            else:
                print(f"  [FAIL] 分块 {part_num} 上传失败: {put_resp.status_code} {put_resp.text[:200]}")
                return None
    return parts_info


def s3_complete_multipart_upload(token, upload_data, parts_info):
    url = "https://123pan.com/b/api/file/s3_complete_multipart_upload"
    data = {"bucket": upload_data.get("Bucket"), "key": upload_data.get("Key"),
            "parts": parts_info, "fileId": upload_data.get("FileId"),
            "uploadId": upload_data.get("UploadId"), "readOnly": False}
    resp = requests.post(url, headers=make_headers(token), json=data, timeout=60)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            print("[OK] 完成 S3 分块上传")
            return True
    print(f"[FAIL] 完成分块上传失败: {resp.text[:200]}")
    return False


def upload_complete(token, upload_data, file_name, parent_id, size):
    url = "https://123pan.com/b/api/file/upload_complete"
    file_id = upload_data.get("FileId")
    data = {"driveId": 0, "duplicate": 2, "etag": "", "fileName": file_name,
            "parentFileId": parent_id, "size": size, "Type": 0,
            "fileType": 0, "fileId": file_id, "NotReuse": True}
    if size > 64 * 1024 * 1024:
        print("[INFO] 大文件, 等待 3 秒...")
        time.sleep(3)
    resp = requests.post(url, headers=make_headers(token), json=data, timeout=60)
    if resp.status_code == 200:
        result = resp.json()
        if result.get("code") in (0, 200):
            print("[OK] 完成上传会话")
            return True
    print(f"[FAIL] 完成上传会话失败: {resp.text[:200]}")
    return False


def upload_one_file(token, filepath, file_name, parent_id):
    size = os.path.getsize(filepath)
    print(f"\n{'='*60}")
    print(f"开始上传: {file_name} ({size} bytes)")
    print(f"{'='*60}")

    result = upload_request(token, filepath, file_name, parent_id)
    if result is None:
        return False
    if result == "instant":
        print(f"[OK] 秒传成功: {file_name}")
        return True

    upload_data = result
    parts_info = upload_file_presigned(token, upload_data, filepath)
    if parts_info is None:
        return False

    if not s3_complete_multipart_upload(token, upload_data, parts_info):
        return False

    if not upload_complete(token, upload_data, file_name, parent_id, size):
        return False

    print(f"[OK] 上传完成: {file_name}")
    return True


def main():
    token = login()
    folder_id = find_or_create_folder(token, REMOTE_PATH)
    print(f"[OK] 目标文件夹 ID: {folder_id}")

    success_count = 0
    for local_path, remote_name in UPLOAD_FILES:
        if not os.path.exists(local_path):
            print(f"[WARN] 文件不存在: {local_path}, 跳过")
            continue
        if upload_one_file(token, local_path, remote_name, folder_id):
            success_count += 1
        else:
            print(f"[FAIL] 上传失败: {remote_name}")

    print(f"\n{'='*60}")
    print(f"上传完成: {success_count}/{len(UPLOAD_FILES)} 个文件成功")
    print(f"{'='*60}")
    return 0 if success_count == len(UPLOAD_FILES) else 1


if __name__ == "__main__":
    sys.exit(main())
