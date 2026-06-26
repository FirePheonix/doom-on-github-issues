export function createJobQueue({ statusStore, beforeJob }) {
  function schedule(issueNumber, job, delayMs = 0) {
    statusStore.set(issueNumber, { state: "queued" });

    setTimeout(async () => {
      try {
        statusStore.set(issueNumber, { state: "running" });
        if (beforeJob) {
          await beforeJob();
        }
        await job();
        statusStore.set(issueNumber, { state: "completed" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        statusStore.set(issueNumber, {
          state: "failed",
          error: message
        });
        console.error("Webhook job failed:", error);
      }
    }, Math.max(0, delayMs));
  }

  return { schedule };
}

