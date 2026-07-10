import { disconnectRedis } from "./cache/redis.js";
import { createRuntimeServices } from "./runtime.js";

async function main() {
  const runtimeServices = createRuntimeServices();
  try {
    const recovery = await runtimeServices.prime();

    console.log(JSON.stringify({
      ok: true,
      frameStoreKind: runtimeServices.repositoryInfo.frameStoreKind,
      redisConfigured: runtimeServices.repositoryInfo.redisConfigured,
      bootFrame: recovery.bootFrame,
      menuFrames: recovery.menuFrames
    }, null, 2));
  } finally {
    await disconnectRedis();
  }
}

await main();
