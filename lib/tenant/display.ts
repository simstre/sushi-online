type TenantNameSource = { name: string; locationName?: string | null };

/**
 * Formats a tenant's display name. Appends `locationName` only when it adds
 * information — if the location name is already part of the restaurant name
 * (e.g. "Sushi U Burnaby" + "Burnaby") we'd just produce "Sushi U Burnaby -
 * Burnaby", which is noise.
 */
export function displayTenantName(tenant: TenantNameSource): string {
  const name = tenant.name.trim();
  const loc = tenant.locationName?.trim();
  if (!loc) return name;
  const needle = loc.toLowerCase();
  const haystack = name.toLowerCase();
  // Word-boundary-ish check so "Main" doesn't collide with "Remainder".
  const re = new RegExp(`(?:^|\\W)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\W|$)`);
  if (re.test(haystack)) return name;
  return `${name} - ${loc}`;
}

/**
 * Returns a banner image URL for the tenant: their uploaded banner if set,
 * otherwise a deterministic loremflickr image themed to food/restaurants,
 * seeded by the slug so each tenant has a stable look.
 */
export function tenantBannerUrl(tenant: { slug: string; bannerUrl?: string | null }): string {
  if (tenant.bannerUrl) return tenant.bannerUrl;
  let h = 0;
  for (let i = 0; i < tenant.slug.length; i++) {
    h = (h * 31 + tenant.slug.charCodeAt(i)) | 0;
  }
  const lock = Math.abs(h) % 10_000;
  return `https://loremflickr.com/1600/500/restaurant,food?lock=${lock}`;
}
