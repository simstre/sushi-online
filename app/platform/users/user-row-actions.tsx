"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserRowActions({
  userId,
  email,
  isSuperAdmin,
}: {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSuperAdmin() {
    const next = !isSuperAdmin;
    const label = next ? "grant" : "revoke";
    if (!confirm(`${label === "grant" ? "Grant" : "Revoke"} superadmin for ${email}?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSuperAdmin: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Update failed" }));
      setError(body.error ?? "Update failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleSuperAdmin}
        disabled={busy || pending}
      >
        {isSuperAdmin ? "Revoke super" : "Make super"}
      </Button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
