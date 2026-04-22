export type HoursEntry = { day: number; open: string; close: string };
export type BusinessHours = HoursEntry[];

export const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Accepts the Prisma Json field and returns a validated BusinessHours array. */
export function parseHours(json: unknown): BusinessHours {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (e: unknown): e is HoursEntry =>
      !!e &&
      typeof e === "object" &&
      typeof (e as HoursEntry).day === "number" &&
      typeof (e as HoursEntry).open === "string" &&
      typeof (e as HoursEntry).close === "string",
  );
}

/** "13:30" → "1:30 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Current open/closed status with next-change hint for display. */
export function openStatus(
  hours: BusinessHours,
  now = new Date(),
): { open: boolean; label: string } {
  if (hours.length === 0) return { open: false, label: "Hours not set" };

  const day = now.getDay();
  const current = now.getHours() * 60 + now.getMinutes();

  const today = hours.filter((e) => e.day === day);
  for (const slot of today) {
    const open = minutesOfDay(slot.open);
    const close = minutesOfDay(slot.close);
    if (current >= open && current < close) {
      return { open: true, label: `Open · Closes at ${formatTime(slot.close)}` };
    }
  }

  // Find next opening slot within a 7-day window.
  for (let i = 0; i < 7; i++) {
    const checkDay = (day + i) % 7;
    const slots = hours
      .filter((e) => e.day === checkDay)
      .sort((a, b) => minutesOfDay(a.open) - minutesOfDay(b.open));
    for (const slot of slots) {
      const open = minutesOfDay(slot.open);
      if (i > 0 || open > current) {
        const when =
          i === 0
            ? `today at ${formatTime(slot.open)}`
            : i === 1
              ? `tomorrow at ${formatTime(slot.open)}`
              : `${DAY_FULL[checkDay]} at ${formatTime(slot.open)}`;
        return { open: false, label: `Closed · Opens ${when}` };
      }
    }
  }

  return { open: false, label: "Closed" };
}

/** Group hours by day for display; returns 7 rows in week order starting Sunday. */
export function groupByDay(hours: BusinessHours): Array<{ day: number; slots: HoursEntry[] }> {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    slots: hours.filter((e) => e.day === day).sort((a, b) => a.open.localeCompare(b.open)),
  }));
}
