import { createRuntimeServices } from "./runtime.js";

async function main() {
  const runtimeServices = createRuntimeServices();
  const recovery = await runtimeServices.prime();

  console.log(JSON.stringify({
    ok: true,
    frameStoreKind: runtimeServices.repositoryInfo.frameStoreKind,
    bootFrame: recovery.bootFrame,
    menuFrames: recovery.menuFrames
  }, null, 2));
}

await main();
