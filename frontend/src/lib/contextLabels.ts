export function humanizeSlug(slug: string): string {
  if (!slug) return "";
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
