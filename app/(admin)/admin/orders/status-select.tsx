"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tenantFetch } from "@/lib/tenant/client-url";

const STATUSES = ["pending", "paid", "preparing", "ready", "completed", "failed", "cancelled"];

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setError(null);
    const res = await tenantFetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setError(await res.text());
      setValue(status);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col">
      <select
        className="rounded border border-border bg-background px-2 py-1 text-sm"
        value={value}
        onChange={onChange}
        disabled={pending}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
