"use client";

import Link from "next/link";
import { useCart } from "@/lib/stores/cart";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export function CartView({
  currency = "CAD",
  minOrder = 0,
}: {
  currency?: string;
  minOrder?: number;
}) {
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const shortfall = minOrder > 0 ? Math.max(0, minOrder - total) : 0;
  const meetsMin = shortfall === 0;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Your cart is empty
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick something from the menu to get started.
        </p>
        <Link href="/menu" className="mt-5 inline-block">
          <Button variant="outline">Browse the menu</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6 md:py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
        Your cart
      </h1>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
        {items.map((item) => (
          <li key={item.lineId} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold tracking-tight">
                {item.name}
              </p>
              {item.modifiers.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {item.modifiers.map((g) => (
                    <li key={g.groupId} className="truncate">
                      <span className="font-medium">{g.groupName}:</span>{" "}
                      {g.choices.map((c) => c.name).join(", ")}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
                {formatMoney(item.unitPrice, currency)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity(item.lineId, item.quantity - 1)}
                aria-label="Decrease"
              >
                −
              </Button>
              <span className="w-6 text-center tabular-nums">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity(item.lineId, item.quantity + 1)}
                aria-label="Increase"
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => remove(item.lineId)}
                aria-label="Remove"
              >
                ✕
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t-2 border-foreground pt-4">
        <span className="font-display text-xl font-semibold">Total</span>
        <span className="font-display text-xl font-bold tabular-nums">
          {formatMoney(total, currency)}
        </span>
      </div>

      {!meetsMin && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Add <strong>{formatMoney(shortfall, currency)}</strong> more to reach the{" "}
          {formatMoney(minOrder, currency)} minimum order.
        </p>
      )}

      {meetsMin ? (
        <Link href="/checkout" className="block">
          <Button className="w-full" size="lg">
            Continue to checkout
          </Button>
        </Link>
      ) : (
        <Button className="w-full" size="lg" disabled>
          Continue to checkout
        </Button>
      )}
    </div>
  );
}
