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
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link href="/menu" className="mt-4 inline-block underline">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4 md:py-6">
      <h1 className="text-2xl font-semibold">Cart</h1>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {items.map((item) => (
          <li key={item.lineId} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              {item.modifiers.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                  {item.modifiers.map((g) => (
                    <li key={g.groupId} className="truncate">
                      <span className="font-medium">{g.groupName}:</span>{" "}
                      {g.choices.map((c) => c.name).join(", ")}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground">
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
      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-lg font-semibold">{formatMoney(total, currency)}</span>
      </div>

      {!meetsMin && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Add {formatMoney(shortfall, currency)} more to reach the{" "}
          {formatMoney(minOrder, currency)} minimum order.
        </p>
      )}

      {meetsMin ? (
        <Link href="/checkout" className="block">
          <Button className="w-full" size="lg">
            Checkout
          </Button>
        </Link>
      ) : (
        <Button className="w-full" size="lg" disabled>
          Checkout
        </Button>
      )}
    </div>
  );
}
