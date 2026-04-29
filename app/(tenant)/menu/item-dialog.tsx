"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import {
  computeUnitPrice,
  useCart,
  type SelectedModifierGroup,
} from "@/lib/stores/cart";

export type DialogModifierChoice = { id: string; name: string; price: number };
export type DialogModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number; // 1 = radio, 0 = unlimited, 2+ = capped multi
  choices: DialogModifierChoice[];
};

export type DialogItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  modifiers: DialogModifierGroup[];
};

type Props = {
  item: DialogItem;
  currency: string;
  open: boolean;
  onClose: () => void;
};

// State shape: groupId -> Set of chosen choiceIds.
type Selection = Record<string, Set<string>>;

function initialSelection(groups: DialogModifierGroup[]): Selection {
  const out: Selection = {};
  for (const g of groups) out[g.id] = new Set<string>();
  return out;
}

export function ItemDialog({ item, currency, open, onClose }: Props) {
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(item.modifiers),
  );
  const add = useCart((s) => s.add);

  // Reset whenever the dialog opens on a new item so state doesn't leak
  // between items if the same component instance is reused.
  useEffect(() => {
    if (open) setSelection(initialSelection(item.modifiers));
  }, [open, item.id, item.modifiers]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selectedGroups: SelectedModifierGroup[] = useMemo(() => {
    return item.modifiers
      .map((g) => {
        const picks = g.choices.filter((c) => selection[g.id]?.has(c.id));
        return {
          groupId: g.id,
          groupName: g.name,
          choices: picks.map((c) => ({
            choiceId: c.id,
            name: c.name,
            price: c.price,
          })),
        };
      })
      .filter((g) => g.choices.length > 0);
  }, [item.modifiers, selection]);

  const unitPrice = computeUnitPrice(item.price, selectedGroups);

  // Required groups must have ≥1 selection before we allow Add.
  const unsatisfied = item.modifiers.filter(
    (g) => g.required && (selection[g.id]?.size ?? 0) === 0,
  );
  const canAdd = unsatisfied.length === 0;

  function toggle(g: DialogModifierGroup, choiceId: string) {
    setSelection((prev) => {
      const next: Selection = { ...prev, [g.id]: new Set(prev[g.id] ?? []) };
      const set = next[g.id];
      if (g.maxSelect === 1) {
        // Radio: replace.
        set.clear();
        set.add(choiceId);
      } else if (set.has(choiceId)) {
        set.delete(choiceId);
      } else {
        if (g.maxSelect > 1 && set.size >= g.maxSelect) {
          // At cap; no-op on additional selections.
          return prev;
        }
        set.add(choiceId);
      }
      return next;
    });
  }

  function handleAdd() {
    if (!canAdd) return;
    add({
      menuItemId: item.id,
      name: item.name,
      unitPrice,
      imageUrl: item.imageUrl,
      modifiers: selectedGroups,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-background shadow-xl md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: image on top if available, otherwise a compact header. */}
        {item.imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              className="h-56 w-full object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow backdrop-blur hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end p-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
          <h2 className="text-2xl font-extrabold tracking-[-0.01em]">
            {item.name}
          </h2>
          {item.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          )}

          {item.modifiers.length > 0 && (
            <div className="mt-5 space-y-6">
              {item.modifiers.map((g) => (
                <ModifierGroupBlock
                  key={g.id}
                  group={g}
                  currency={currency}
                  selectedIds={selection[g.id] ?? new Set()}
                  onToggle={(cid) => toggle(g, cid)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-border bg-background p-4">
          {unsatisfied.length > 0 && (
            <p className="mb-2 text-xs text-amber-700">
              Please choose from: {unsatisfied.map((g) => g.name).join(", ")}
            </p>
          )}
          <Button
            onClick={handleAdd}
            disabled={!canAdd}
            size="lg"
            className="w-full justify-between"
          >
            <span>Add to cart</span>
            <span className="font-semibold">{formatMoney(unitPrice, currency)}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModifierGroupBlock({
  group,
  currency,
  selectedIds,
  onToggle,
}: {
  group: DialogModifierGroup;
  currency: string;
  selectedIds: Set<string>;
  onToggle: (choiceId: string) => void;
}) {
  const isRadio = group.maxSelect === 1;
  const hint = group.required
    ? "Required"
    : group.maxSelect > 1
      ? `Choose up to ${group.maxSelect}`
      : "Optional";
  return (
    <fieldset>
      <legend className="flex items-center justify-between">
        <span className="text-sm font-semibold">{group.name}</span>
        <span
          className={cn(
            "text-[11px] uppercase tracking-wide",
            group.required ? "text-amber-700" : "text-muted-foreground",
          )}
        >
          {hint}
        </span>
      </legend>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
        {group.choices.map((c) => {
          const checked = selectedIds.has(c.id);
          return (
            <li key={c.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted",
                  checked && "bg-muted",
                )}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <input
                    type={isRadio ? "radio" : "checkbox"}
                    name={group.id}
                    value={c.id}
                    checked={checked}
                    onChange={() => onToggle(c.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="truncate">{c.name}</span>
                </span>
                {c.price !== 0 && (
                  <span className="shrink-0 text-muted-foreground">
                    {c.price > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(c.price), currency)}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
