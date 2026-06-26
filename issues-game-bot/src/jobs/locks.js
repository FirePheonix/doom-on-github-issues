export function createLockStore() {
  const locks = new Map();

  async function withIssueLock(issueNumber, task) {
    const previous = locks.get(issueNumber) || Promise.resolve();
    const current = previous.then(task, task);
    locks.set(issueNumber, current.finally(() => {
      if (locks.get(issueNumber) === current) {
        locks.delete(issueNumber);
      }
    }));
    return current;
  }

  return { withIssueLock };
}

