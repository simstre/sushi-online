"use client";

import { DAY_FULL, type BusinessHours, type HoursEntry } from "@/lib/tenant/hours";
import { Input } from "@/components/ui/input";

type Props = {
  value: BusinessHours;
  onChange: (next: BusinessHours) => void;
};

export function HoursEditor({ value, onChange }: Props) {
  function slotFor(day: number): HoursEntry | null {
    return value.find((e) => e.day === day) ?? null;
  }

  function setSlot(day: number, slot: HoursEntry | null) {
    const without = value.filter((e) => e.day !== day);
    onChange(slot ? [...without, slot].sort((a, b) => a.day - b.day) : without);
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-sm font-medium">Business hours</p>
      <ul className="space-y-2">
        {DAY_FULL.map((name, day) => {
          const slot = slotFor(day);
          const closed = !slot;
          return (
            <li
              key={day}
              className="grid grid-cols-[100px_auto_1fr_auto_1fr] items-center gap-2 text-sm"
            >
              <span>{name}</span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) =>
                    setSlot(
                      day,
                      e.target.checked ? null : { day, open: "11:30", close: "22:00" },
                    )
                  }
                />
                Closed
              </label>
              <Input
                type="time"
                disabled={closed}
                value={slot?.open ?? ""}
                onChange={(e) =>
                  slot && setSlot(day, { ...slot, open: e.target.value })
                }
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                disabled={closed}
                value={slot?.close ?? ""}
                onChange={(e) =>
                  slot && setSlot(day, { ...slot, close: e.target.value })
                }
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        One slot per day. Need split hours (lunch + dinner)? Edit via API for now.
      </p>
    </div>
  );
}
