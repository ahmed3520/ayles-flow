"""
R2 Client — Cloudflare R2 storage via boto3 S3 API.

Stores project files at: projects/{project_id}/{relative_path}
Metadata at: projects/{project_id}/_meta.json
"""

import json
import os
import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError

log = logging.getLogger("r2")

EXCLUDED_PREFIXES = [
    "node_modules/", ".git/", "dist/", ".next/",
    "build/", "__pycache__/", ".cache/", ".turbo/",
]

DEFAULT_WORKDIR = "/home/user/app/"


def _get_client():
    account_id = os.getenv("CF_ACCOUNT_ID")
    bucket = os.getenv("R2_BUCKET_NAME")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    if not all([account_id, bucket, access_key, secret_key]):
        raise RuntimeError("CF_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY required")

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )
    return client, bucket


def _is_excluded(path: str) -> bool:
    return any(path.startswith(p) for p in EXCLUDED_PREFIXES)


def _key(project_id: str, relative_path: str) -> str:
    return f"projects/{project_id}/{relative_path}"


# --- File operations ---

def r2_put(project_id: str, relative_path: str, content: str) -> None:
    if _is_excluded(relative_path):
        return
    client, bucket = _get_client()
    key = _key(project_id, relative_path)
    client.put_object(Bucket=bucket, Key=key, Body=content.encode("utf-8"))
    log.info(f"PUT {relative_path} ({len(content)} bytes)")


def r2_get(project_id: str, relative_path: str) -> Optional[str]:
    client, bucket = _get_client()
    key = _key(project_id, relative_path)
    try:
        resp = client.get_object(Bucket=bucket, Key=key)
        return resp["Body"].read().decode("utf-8")
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return None
        raise


def r2_delete(project_id: str, relative_path: str) -> None:
    client, bucket = _get_client()
    key = _key(project_id, relative_path)
    client.delete_object(Bucket=bucket, Key=key)


def r2_list_files(project_id: str) -> list[str]:
    client, bucket = _get_client()
    prefix = f"projects/{project_id}/"
    files = []
    continuation_token = None

    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token

        resp = client.list_objects_v2(**kwargs)

        for obj in resp.get("Contents", []):
            rel = obj["Key"][len(prefix):]
            if rel and rel != "_meta.json":
                files.append(rel)

        if resp.get("IsTruncated"):
            continuation_token = resp.get("NextContinuationToken")
        else:
            break

    return files


# --- Metadata ---

def r2_put_meta(project_id: str, meta: dict) -> None:
    client, bucket = _get_client()
    key = f"projects/{project_id}/_meta.json"
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(meta).encode("utf-8"),
        ContentType="application/json",
    )


def r2_get_meta(project_id: str) -> Optional[dict]:
    client, bucket = _get_client()
    key = f"projects/{project_id}/_meta.json"
    try:
        resp = client.get_object(Bucket=bucket, Key=key)
        return json.loads(resp["Body"].read().decode("utf-8"))
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return None
        raise


# --- Path helper ---

def to_relative_path(absolute_path: str, workdir: str = DEFAULT_WORKDIR) -> str:
    if absolute_path.startswith(workdir):
        return absolute_path[len(workdir):]
    if absolute_path.startswith("./"):
        return absolute_path[2:]
    return absolute_path
