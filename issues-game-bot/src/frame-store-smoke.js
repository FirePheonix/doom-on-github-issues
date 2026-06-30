import { getDefaultFrameStoreKind } from "./frameStore/index.js";

function main() {
  const originalFrameStore = process.env.FRAME_STORE;
  const originalBucket = process.env.FRAME_S3_BUCKET;

  try {
    delete process.env.FRAME_STORE;
    delete process.env.FRAME_S3_BUCKET;

    if (getDefaultFrameStoreKind() !== "local") {
      throw new Error("Expected local frame store without S3 env");
    }

    process.env.FRAME_S3_BUCKET = "demo-bucket";
    if (getDefaultFrameStoreKind() !== "s3") {
      throw new Error("Expected S3 frame store when FRAME_S3_BUCKET is present");
    }

    process.env.FRAME_STORE = "local";
    if (getDefaultFrameStoreKind() !== "local") {
      throw new Error("Expected explicit FRAME_STORE override to win");
    }

    console.log("frame-store-smoke ok");
  } finally {
    process.env.FRAME_STORE = originalFrameStore;
    process.env.FRAME_S3_BUCKET = originalBucket;
  }
}

main();
