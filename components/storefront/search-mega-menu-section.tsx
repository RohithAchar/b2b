import { getCachedMegaMenuCategories } from "@/lib/storefront-cache";
import { SearchMegaMenu } from "./search-mega-menu";

const TRENDING_SEARCHES = [
  "cotton fabric",
  "led lights",
  "jute bags",
  "steel bottles",
  "spices",
];

/**
 * Homepage hero: the search mega menu fed with live catalog categories.
 * Streams in via Suspense on the homepage; renders nothing when no
 * categories exist yet.
 */
export async function SearchMegaMenuSection() {
  const categories = await getCachedMegaMenuCategories();
  if (categories.length === 0) return null;
  return <SearchMegaMenu categories={categories} trending={TRENDING_SEARCHES} />;
}
