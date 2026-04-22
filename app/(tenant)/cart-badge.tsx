"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useCart } from "@/lib/stores/cart";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";

type Props = {
  currency?: string;
  minOrder?: number;
};

export function CartBadge({ currency = "CAD", minOrder = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shortfall = minOrder > 0 ? Math.max(0, minOrder - subtotal) : 0;
  const meetsMin = shortfall === 0;

  // Fade-in on open.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:text-foreground"
        aria-label={count === 0 ? "Open cart" : `Open cart (${count} items)`}
        aria-expanded={open}
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="tabular-nums">{count}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Cart"
          className={cn(
            "absolute right-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-sm origin-top-right rounded-lg border border-border bg-background shadow-xl transition-all duration-150",
            entered ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold">Your cart</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-3">
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Your cart is empty.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(item.price, currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQuantity(item.id, item.quantity - 1)}
                        aria-label="Decrease"
                      >
                        −
                      </Button>
                      <span className="w-5 text-center text-xs tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase"
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => remove(item.id)}
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="space-y-2 border-t border-border px-4 py-3">
            {!meetsMin && items.length > 0 && (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                Add {formatMoney(shortfall, currency)} more to reach the{" "}
                {formatMoney(minOrder, currency)} minimum.
              </p>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
            </div>
            {items.length === 0 ? (
              <Button className="w-full" disabled>
                Checkout
              </Button>
            ) : meetsMin ? (
              <Link href="/checkout" className="block" onClick={() => setOpen(false)}>
                <Button className="w-full">Checkout</Button>
              </Link>
            ) : (
              <Button className="w-full" disabled>
                Checkout
              </Button>
            )}
          </footer>
        </div>
      )}
    </div>
  );
}
