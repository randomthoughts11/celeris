/** Server-side: true when Neon DATABASE_URL is set */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Client-safe demo flag — set NEXT_PUBLIC_DEMO_MODE=true only when no database */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
