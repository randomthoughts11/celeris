export default function SetupPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Agency OS is not configured</h1>
      <p className="text-sm text-muted-foreground">
        Clerk and a Neon database are required in production. Missing secrets no
        longer open the app. Set <code>DATABASE_URL</code>,{" "}
        <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>, and{" "}
        <code>CLERK_SECRET_KEY</code>.
      </p>
      <p className="text-sm text-muted-foreground">
        For local seed browsing without Clerk, set <code>DEMO_MODE=true</code>{" "}
        with a populated database. That flag is explicit — it is never inferred
        from missing keys.
      </p>
    </main>
  );
}
