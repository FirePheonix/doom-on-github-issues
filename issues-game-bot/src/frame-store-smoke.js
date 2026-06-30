import { createS3FrameStore, getDefaultFrameStoreKind } from "./frameStore/index.js";

function main() {
  const originalFrameStore = process.env.FRAME_STORE;
  const originalBucket = process.env.FRAME_S3_BUCKET;
  const originalSimpleBucket = process.env.S3_BUCKET_NAME;

  try {
    delete process.env.FRAME_STORE;
    delete process.env.FRAME_S3_BUCKET;
    delete process.env.S3_BUCKET_NAME;

    if (getDefaultFrameStoreKind() !== "local") {
      throw new Error("Expected local frame store without S3 env");
    }

    process.env.S3_BUCKET_NAME = "demo-bucket";
    if (getDefaultFrameStoreKind() !== "s3") {
      throw new Error("Expected S3 frame store when S3_BUCKET_NAME is present");
    }

    process.env.FRAME_STORE = "local";
    if (getDefaultFrameStoreKind() !== "local") {
      throw new Error("Expected explicit FRAME_STORE override to win");
    }

    const store = createS3FrameStore({
      bucket: "demo-bucket",
      region: "eu-north-1",
      prefix: "vedaai"
    });
    const bootUrl = store.publicUrl({ issueNumber: 24, tick: "boot-123" });
    const liveUrl = store.publicUrl({ issueNumber: 24, tick: 3 });
    if (!bootUrl.endsWith("/vedaai/24/boot-123.png")) {
      throw new Error(`Expected versioned boot frame URL, got ${bootUrl}`);
    }
    if (!liveUrl.endsWith("/vedaai/24/3.png")) {
      throw new Error(`Expected versioned live frame URL, got ${liveUrl}`);
    }

    console.log("frame-store-smoke ok");
  } finally {
    process.env.FRAME_STORE = originalFrameStore;
    process.env.FRAME_S3_BUCKET = originalBucket;
    process.env.S3_BUCKET_NAME = originalSimpleBucket;
  }
}

main();
