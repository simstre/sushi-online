"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  restaurantId: string;
  inactive: boolean;
  orderOpen: boolean;
  hasOrders: boolean;
};

export function RestaurantControls({ restaurantId, inactive, orderOpen, hasOrders }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete this restaurant permanently? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error ?? "Delete failed");
      return;
    }
    router.push("/platform/restaurants");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => patch({ inactive: !inactive }, "inactive")}
        >
          {busy === "inactive"
            ? "Saving..."
            : inactive
              ? "Reactivate tenant"
              : "Suspend (set inactive)"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => patch({ orderOpen: !orderOpen }, "orderOpen")}
        >
          {busy === "orderOpen"
            ? "Saving..."
            : orderOpen
              ? "Close ordering"
              : "Open ordering"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy !== null || hasOrders}
          onClick={remove}
          title={hasOrders ? "Has order history — suspend instead" : undefined}
        >
          {busy === "delete" ? "Deleting..." : "Delete"}
        </Button>
      </div>
      {hasOrders && (
        <p className="text-xs text-muted-foreground">
          Tenants with order history can&apos;t be hard-deleted; suspend instead.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
