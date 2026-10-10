export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "chronicle";
}

// Chronicle URLs look like /chronicles/42-zeek; only the id is authoritative.
export function chroniclePath(c: { id: number; slug: string }): string {
  return `/chronicles/${c.id}-${c.slug}`;
}

export function parseChronicleId(param: string): number | null {
  const id = Number.parseInt(param, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
