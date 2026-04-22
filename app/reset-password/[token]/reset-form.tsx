"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Reset failed" }));
      setError(error ?? "Reset failed");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Password updated. You can sign in with your new password now.
        </p>
        <a href="/login" className="block">
          <Button className="w-full">Go to sign in</Button>
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="block text-sm">
        New password
        <Input
          className="mt-1"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          At least 8 characters.
        </span>
      </label>
      <label className="block text-sm">
        Confirm new password
        <Input
          className="mt-1"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        className="w-full"
        disabled={busy || !newPassword || !confirmPassword}
      >
        {busy ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
