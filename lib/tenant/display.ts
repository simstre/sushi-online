type TenantNameSource = { name: string; locationName?: string | null };

/**
 * Formats a tenant's display name. For multi-location brands, pass a
 * non-empty locationName to get "Brand - Location"; standalone restaurants
 * get just the base name.
 */
export function displayTenantName(tenant: TenantNameSource): string {
  const loc = tenant.locationName?.trim();
  return loc ? `${tenant.name} - ${loc}` : tenant.name;
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
