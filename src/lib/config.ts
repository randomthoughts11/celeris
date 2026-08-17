/** Server-side: true when Neon DATABASE_URL is set */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** True when Clerk publishable + secret keys are set */
export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
  );
}

/** True when production auth (Clerk + database) is ready */
export function isAuthConfigured(): boolean {
  return isDatabaseConfigured() && isClerkConfigured();
}

/**
 * Explicit seed/demo browsing. Never inferred from missing secrets.
 * Requires DATABASE_URL. Does not skip auth when Clerk is configured.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
