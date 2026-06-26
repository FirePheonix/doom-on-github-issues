export function createJobStatusStore() {
  const statuses = new Map();

  function set(issueNumber, status) {
    statuses.set(issueNumber, {
      ...status,
      at: new Date().toISOString()
    });
  }

  function get(issueNumber) {
    return statuses.get(issueNumber) || { state: "unknown" };
  }

  return { get, set };
}

