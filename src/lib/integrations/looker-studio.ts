const LOOKER_EMBED_HOSTS = new Set([
  "lookerstudio.google.com",
  "datastudio.google.com",
]);

/** Normalize and validate a Looker Studio embed URL. */
export function parseLookerEmbedUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (!LOOKER_EMBED_HOSTS.has(url.hostname)) return null;
    if (!url.pathname.startsWith("/embed/reporting/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
