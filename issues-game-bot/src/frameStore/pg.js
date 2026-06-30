export function getDefaultFrameStoreKind(env = process.env) {
  const configured = env.FRAME_STORE?.trim().toLowerCase();
  if (configured) {
    return configured;
  }
  return env.S3_BUCKET_NAME || env.FRAME_S3_BUCKET ? "s3" : "local";
}
