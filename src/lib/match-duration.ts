export function formatMatchDuration(startedAt: string | null, endedAt: string | null, now = Date.now()) {
  if (!startedAt) return null;
  const startTime = new Date(startedAt).getTime();
  const endTime = endedAt ? new Date(endedAt).getTime() : now;
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;

  const elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
