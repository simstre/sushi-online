"use client";

import { useState } from "react";
import { Flame, Leaf, Plus, Star } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { TAG_INFO, type MenuItemTag } from "@/lib/menu/tags";
import { ItemDialog, type DialogItem } from "./item-dialog";

type Props = {
  item: DialogItem & {
    tags: MenuItemTag[];
    isAvailable: boolean;
  };
  rank?: number;
  currency: string;
};

export function ItemCard({ item, rank, currency }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <li
        className="group flex cursor-pointer items-stretch overflow-hidden rounded-lg border border-border bg-background transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={`View ${item.name}`}
      >
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
            {item.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.includes("favorite") && (
              <Badge tag="favorite" />
            )}
            {rank && !item.tags.includes("favorite") && (
              <span
                className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  background: "var(--badge-favorite-bg)",
                  color: "var(--badge-favorite-fg)",
                  borderColor: "var(--badge-favorite-border)",
                }}
              >
                #{rank} Most liked
              </span>
            )}
            {item.tags
              .filter((t) => t !== "favorite")
              .map((tag) => (
                <Badge key={tag} tag={tag} />
              ))}
          </div>
          {item.description && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-3 text-sm">
            <span className="font-semibold tabular-nums">
              {formatMoney(item.price, currency)}
            </span>
            {!item.imageUrl && <PlusButton label={item.name} />}
          </div>
        </div>
        {item.imageUrl && (
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              className="h-32 w-32 object-cover transition-transform group-hover:scale-[1.03] md:h-40 md:w-40"
              loading="lazy"
            />
            <div className="absolute bottom-2 right-2">
              <PlusButton label={item.name} />
            </div>
          </div>
        )}
      </li>

      <ItemDialog
        item={item}
        currency={currency}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function Badge({ tag }: { tag: MenuItemTag }) {
  const info = TAG_INFO[tag];
  const Icon = tag === "favorite" ? Star : tag === "spicy" ? Flame : Leaf;
  const palette =
    tag === "favorite"
      ? {
          background: "var(--badge-favorite-bg)",
          color: "var(--badge-favorite-fg)",
          borderColor: "var(--badge-favorite-border)",
        }
      : tag === "spicy"
        ? {
            background: "var(--badge-spicy-bg)",
            color: "var(--badge-spicy-fg)",
            borderColor: "var(--badge-spicy-border)",
          }
        : {
            background: "var(--badge-vegan-bg)",
            color: "var(--badge-vegan-fg)",
            borderColor: "var(--badge-vegan-border)",
          };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
      )}
      style={palette}
    >
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

// Visual-only — the actual opening is handled by the surrounding clickable card.
function PlusButton({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      title={`Open ${label}`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-transform group-hover:scale-110"
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </span>
  );
}
