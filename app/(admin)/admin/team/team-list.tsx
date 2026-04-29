"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
};

export function TeamList({
  members,
  variant,
}: {
  members: Member[];
  variant: "pending" | "active";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (members.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        {variant === "pending" ? "No pending requests." : "No active members yet."}
      </p>
    );
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(e?.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  async function remove(id: string, confirmText: string) {
    if (!confirm(confirmText)) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(e?.error ?? "Remove failed");
      return;
    }
    router.refresh();
  }

  return (
    <ul className="mt-3 space-y-2">
      {members.map((m) => (
        <li
          key={m.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{m.name ?? m.email}</p>
            <p className="text-xs text-muted-foreground">
              {m.email} · {m.role} · requested {new Date(m.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {variant === "pending" ? (
              <>
                <Button
                  size="sm"
                  disabled={busyId === m.id}
                  onClick={() => patch(m.id, { status: "active" })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.id}
                  onClick={() => remove(m.id, `Deny access for ${m.email}?`)}
                >
                  Deny
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === m.id}
                onClick={() =>
                  remove(m.id, `Remove ${m.email} from this restaurant?`)
                }
              >
                Remove
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
