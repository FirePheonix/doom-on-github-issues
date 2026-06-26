export function isSessionInactive(state, inactivityMs) {
  if (!state?.lastActivityAt) return false;
  const last = Date.parse(state.lastActivityAt);
  if (!Number.isFinite(last)) return false;
  return Date.now() - last >= inactivityMs;
}

