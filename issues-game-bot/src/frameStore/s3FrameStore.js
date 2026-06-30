import { readFile } from "node:fs/promises";
import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requireEnvValue(value, label) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${label} for S3 frame store`);
  }
  return value.trim();
}

function inferPublicBaseUrl({ bucket, region, publicBaseUrl }) {
  if (publicBaseUrl && publicBaseUrl.trim().length > 0) {
    return publicBaseUrl.replace(/\/$/, "");
  }
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

export function createS3FrameStore({
  bucket = process.env.S3_BUCKET_NAME || process.env.FRAME_S3_BUCKET,
  region = process.env.FRAME_S3_REGION || process.env.AWS_REGION || "us-east-1",
  prefix = process.env.S3_FOLDER_NAME || process.env.FRAME_S3_PREFIX || "frames",
  publicBaseUrl = process.env.FRAME_S3_PUBLIC_BASE_URL || "",
  endpoint = process.env.FRAME_S3_ENDPOINT || "",
  forcePathStyle = (process.env.FRAME_S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true"
} = {}) {
  const safeBucket = requireEnvValue(bucket, "S3_BUCKET_NAME");
  const safeRegion = requireEnvValue(region, "AWS_REGION");
  const safePrefix = prefix.replace(/^\/+|\/+$/g, "");
  const baseUrl = inferPublicBaseUrl({
    bucket: safeBucket,
    region: safeRegion,
    publicBaseUrl
  });

  const client = new S3Client({
    region: safeRegion,
    ...(endpoint ? { endpoint } : {}),
    ...(forcePathStyle ? { forcePathStyle: true } : {})
  });

  function objectKey(issueNumber) {
    return safePrefix ? `${safePrefix}/${issueNumber}.png` : `${issueNumber}.png`;
  }

  async function publish(issueNumber, _tick, localPath) {
    const body = await readFile(localPath);
    await client.send(new PutObjectCommand({
      Bucket: safeBucket,
      Key: objectKey(issueNumber),
      Body: body,
      ContentType: "image/png",
      CacheControl: "no-store, no-cache, must-revalidate, max-age=0"
    }));
  }

  function publicUrl({ issueNumber, tick }) {
    return `${baseUrl}/${objectKey(issueNumber)}?t=${tick}`;
  }

  async function healthCheck() {
    await client.send(new HeadBucketCommand({ Bucket: safeBucket }));
  }

  return {
    kind: "s3",
    bucket: safeBucket,
    region: safeRegion,
    prefix: safePrefix,
    publish,
    publicUrl,
    healthCheck
  };
}
