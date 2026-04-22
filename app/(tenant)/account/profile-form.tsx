"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({ profile }: { profile: { name: string; email: string } }) {
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [passwordReset, setPasswordReset] = useState<{
    state: "idle" | "sending" | "sent" | "error";
    error?: string;
  }>({ state: "idle" });

  const nameDirty = name !== profile.name;

  async function saveName() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Update failed" }));
      setMsg({ kind: "err", text: error ?? "Update failed" });
      return;
    }
    setMsg({ kind: "ok", text: "Saved." });
  }

  async function requestPasswordReset() {
    setPasswordReset({ state: "sending" });
    const res = await fetch("/api/account/request-password-reset", { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Request failed" }));
      setPasswordReset({ state: "error", error: error ?? "Request failed" });
      return;
    }
    setPasswordReset({ state: "sent" });
  }

  return (
    <div className="mt-6 grid gap-4">
      <div className="text-sm">
        <label className="block text-sm">Name</label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            className="flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <Button onClick={saveName} disabled={busy || !nameDirty}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
        {msg && (
          <p
            className={
              msg.kind === "ok"
                ? "mt-1 text-xs text-green-700"
                : "mt-1 text-xs text-red-600"
            }
          >
            {msg.text}
          </p>
        )}
      </div>

      <label className="text-sm">
        Email
        <Input className="mt-1" value={profile.email} disabled />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <Button
            variant="outline"
            onClick={requestPasswordReset}
            disabled={passwordReset.state === "sending" || passwordReset.state === "sent"}
          >
            {passwordReset.state === "sending"
              ? "Sending..."
              : passwordReset.state === "sent"
                ? "Reset link sent"
                : "Change password"}
          </Button>
          {passwordReset.state === "sent" && (
            <p className="mt-1 text-xs text-green-700">
              Check {profile.email} for a reset link (expires in 1 hour).
            </p>
          )}
          {passwordReset.state === "error" && (
            <p className="mt-1 text-xs text-red-600">{passwordReset.error}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
