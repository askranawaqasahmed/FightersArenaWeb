const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Returns the video id for a YouTube watch, share, live or shorts URL.
 * Any other host returns null, so an arbitrary URL can never be framed.
 */
export function parseYouTubeId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return null;

  if (url.hostname.endsWith("youtu.be")) {
    const id = url.pathname.slice(1).split("/")[0];
    return ID_PATTERN.test(id) ? id : null;
  }

  const watchId = url.searchParams.get("v");
  if (watchId && ID_PATTERN.test(watchId)) return watchId;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && ["live", "shorts", "embed", "v"].includes(segments[0])) {
    return ID_PATTERN.test(segments[1]) ? segments[1] : null;
  }
  return null;
}

/** Privacy-preserving embed address for a parsed id. */
export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}
