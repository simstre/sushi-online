"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  isSelf: boolean;
};

export function UserActions({ userId, email, isSuperAdmin, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function patchSuper() {
    const next = !isSuperAdmin;
    if (!confirm(`${next ? "Grant" : "Revoke"} superadmin for ${email}?`)) return;
    setBusy("super");
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSuperAdmin: next }),
    });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  async function sendReset() {
    setBusy("reset");
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body?.error ?? "Failed to send reset email");
      return;
    }
    setInfo(
      body.emailSent
        ? "Reset email sent."
        : `Reset email not delivered${body.emailError ? ` (${body.emailError})` : ""}. Link: ${body.resetUrl}`,
    );
  }

  async function remove() {
    if (!confirm(`Delete ${email}? Their order history will be preserved but unlinked.`)) return;
    setBusy("delete");
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error ?? "Delete failed");
      return;
    }
    router.push("/platform/users");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={sendReset}>
          {busy === "reset" ? "Sending..." : "Send password reset"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null || isSelf}
          onClick={patchSuper}
          title={isSelf ? "You can't change your own role" : undefined}
        >
          {busy === "super"
            ? "Saving..."
            : isSuperAdmin
              ? "Revoke superadmin"
              : "Grant superadmin"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy !== null || isSelf}
          onClick={remove}
          title={isSelf ? "You can't delete your own account" : undefined}
        >
          {busy === "delete" ? "Deleting..." : "Delete user"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && (
        <p className="break-all rounded bg-muted/40 p-2 font-mono text-xs">{info}</p>
      )}
    </div>
  );
}
