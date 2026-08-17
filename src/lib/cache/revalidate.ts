import { revalidatePath } from "next/cache";

/** Invalidate the app shell and nested company routes. */
export function revalidateApp() {
  revalidatePath("/", "layout");
}

export function revalidateCompany(slug?: string | null) {
  revalidateApp();
  if (slug) {
    revalidatePath(`/companies/${slug}`);
    revalidatePath(`/companies/${slug}/board`);
    revalidatePath(`/companies/${slug}/leads`);
    revalidatePath(`/companies/${slug}/calls`);
    revalidatePath(`/companies/${slug}/publish`);
    revalidatePath(`/companies/${slug}/analytics`);
  }
}
