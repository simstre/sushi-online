export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "twitter",
  "tiktok",
  "youtube",
  "linkedin",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type Socials = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter / X",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export function parseSocials(input: unknown): Socials {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Socials = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = (input as Record<string, unknown>)[p];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) out[p] = v;
  }
  return out;
}
