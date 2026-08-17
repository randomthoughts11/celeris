import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That route does not exist, or you do not have access to it.
      </p>
      <Link href="/">
        <Button>Back to brands</Button>
      </Link>
    </div>
  );
}
