import { createLocalFrameStore } from "./localFrameStore.js";
import { getDefaultFrameStoreKind } from "./pg.js";
import { createS3FrameStore } from "./s3FrameStore.js";

export function createFrameStore(options = {}) {
  const kind = (options.kind || getDefaultFrameStoreKind()).trim().toLowerCase();

  if (kind === "s3") {
    return createS3FrameStore(options.s3);
  }

  return createLocalFrameStore(options.local);
}

export { createLocalFrameStore } from "./localFrameStore.js";
export { getDefaultFrameStoreKind } from "./pg.js";
export { createS3FrameStore } from "./s3FrameStore.js";
