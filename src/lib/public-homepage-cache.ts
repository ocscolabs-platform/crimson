import { revalidatePath, updateTag } from "next/cache";

export const PUBLIC_HOMEPAGE_CACHE_TAG = "public-homepage-v1";

/**
 * Expire every published datum that can affect the public homepage. This must
 * be called only after a successful CMS publication (or the explicit Home
 * restore workflow) from a Server Action.
 */
export function invalidatePublicHomepage() {
  updateTag(PUBLIC_HOMEPAGE_CACHE_TAG);
  revalidatePath("/");
}
