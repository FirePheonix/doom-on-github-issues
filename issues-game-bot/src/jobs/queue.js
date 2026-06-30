export function createJobQueue({ statusStore, beforeJob }) {
  function schedule(issueNumber, job, delayMs = 0) {
    const queuedAt = new Date().toISOString();
    statusStore.set(issueNumber, { state: "queued", queuedAt, delayMs: Math.max(0, delayMs) });

    setTimeout(async () => {
      const startedAt = new Date().toISOString();
      const startedMs = Date.now();
      try {
        statusStore.set(issueNumber, { state: "running", queuedAt, startedAt });
        if (beforeJob) {
          await beforeJob();
        }
        await job();
        statusStore.set(issueNumber, {
          state: "completed",
          queuedAt,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedMs
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        statusStore.set(issueNumber, {
          state: "failed",
          error: message,
          queuedAt,
          startedAt,
          failedAt: new Date().toISOString(),
          durationMs: Date.now() - startedMs
        });
        console.error("Webhook job failed:", error);
      }
    }, Math.max(0, delayMs));
  }

  return { schedule };
}
