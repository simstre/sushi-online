"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SelectedModifierChoice = {
  choiceId: string;
  name: string;
  price: number; // delta in cents
};

export type SelectedModifierGroup = {
  groupId: string;
  groupName: string;
  choices: SelectedModifierChoice[];
};

export type CartLine = {
  // Deterministic key combining the menu item + selected modifier choices.
  // Two identical selections collapse into one line with incremented qty.
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: number; // base + sum of chosen deltas, in cents
  quantity: number;
  imageUrl?: string | null;
  modifiers: SelectedModifierGroup[];
};

// Stable key: menu item id + sorted list of chosen choice ids.
export function computeLineId(
  menuItemId: string,
  modifiers: SelectedModifierGroup[],
): string {
  const parts = modifiers
    .flatMap((g) => g.choices.map((c) => `${g.groupId}:${c.choiceId}`))
    .sort();
  return parts.length === 0 ? menuItemId : `${menuItemId}|${parts.join(",")}`;
}

export function computeUnitPrice(
  basePrice: number,
  modifiers: SelectedModifierGroup[],
): number {
  return (
    basePrice +
    modifiers.reduce(
      (acc, g) => acc + g.choices.reduce((a, c) => a + c.price, 0),
      0,
    )
  );
}

type CartState = {
  items: CartLine[];
  add: (line: Omit<CartLine, "quantity" | "lineId"> & { quantity?: number }) => void;
  remove: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (line) =>
        set((state) => {
          const lineId = computeLineId(line.menuItemId, line.modifiers);
          const qty = line.quantity ?? 1;
          const existing = state.items.find((i) => i.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === lineId ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          const newLine: CartLine = {
            lineId,
            menuItemId: line.menuItemId,
            name: line.name,
            unitPrice: line.unitPrice,
            imageUrl: line.imageUrl ?? null,
            modifiers: line.modifiers,
            quantity: qty,
          };
          return { items: [...state.items, newLine] };
        }),
      remove: (lineId) =>
        set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),
      setQuantity: (lineId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.lineId !== lineId)
              : state.items.map((i) =>
                  i.lineId === lineId ? { ...i, quantity } : i,
                ),
        })),
      clear: () => set({ items: [] }),
      total: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "sushi-online-cart",
      // Bump the storage version — the old { id, price, quantity } shape is
      // incompatible. Anything persisted earlier is dropped, which is fine
      // since the cart is ephemeral browser state.
      version: 2,
    },
  ),
);
