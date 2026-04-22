"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart, type CartItem } from "@/lib/stores/cart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  item: Omit<CartItem, "quantity">;
  variant?: "default" | "icon";
  className?: string;
};

const CONFIRM_MS = 900;

export function AddToCartButton({ item, variant = "default", className }: Props) {
  const add = useCart((s) => s.add);
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleClick() {
    add(item);
    setJustAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRM_MS);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={justAdded ? `${item.name} added to cart` : `Add ${item.name} to cart`}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border shadow-md transition-all duration-200",
          justAdded
            ? "scale-110 border-green-600 bg-green-600 text-white"
            : "border-border bg-background hover:scale-105 active:scale-95",
          className,
        )}
      >
        {justAdded ? (
          <Check className="h-4 w-4" strokeWidth={3} />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleClick}
      className={cn(
        "transition-colors",
        justAdded && "bg-green-600 text-white hover:bg-green-600",
      )}
    >
      {justAdded ? (
        <>
          <Check className="mr-1 h-4 w-4" strokeWidth={3} />
          Added
        </>
      ) : (
        "Add"
      )}
    </Button>
  );
}
