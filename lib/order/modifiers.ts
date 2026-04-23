// Format OrderItem.modifiers JSON as a flat, comma-separated human-readable
// string. Returns null when there are no selections.
export function renderOrderModifiers(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const groups = (raw as { groups?: unknown }).groups;
  if (!Array.isArray(groups) || groups.length === 0) return null;
  const parts: string[] = [];
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const gr = g as Record<string, unknown>;
    const choices = Array.isArray(gr.choices) ? gr.choices : [];
    for (const c of choices) {
      if (!c || typeof c !== "object") continue;
      const name = (c as { name?: unknown }).name;
      if (typeof name === "string" && name) parts.push(name);
    }
  }
  return parts.length > 0 ? parts.join(", ") : null;
}
