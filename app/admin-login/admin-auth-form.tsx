"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tenantFetch } from "@/lib/tenant/client-url";

type Mode = "signin" | "signup";

export function AdminAuthForm({ callbackUrl }: { callbackUrl: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === "signup") {
      const signup = await tenantFetch("/api/auth/staff-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      if (!signup.ok) {
        const body = await signup.json().catch(() => ({ error: "Signup failed" }));
        setError(body.error ?? "Signup failed");
        setBusy(false);
        return;
      }
    }

    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (!res || res.error) {
      setError(mode === "signin" ? "Invalid email or password" : "Sign-in failed after signup");
      return;
    }
    window.location.href = callbackUrl;
  }

  return (
    <div className="mt-6">
      <div className="mb-4 inline-flex rounded-md border border-border p-0.5 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
          className={`rounded px-3 py-1 ${mode === "signin" ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`rounded px-3 py-1 ${mode === "signup" ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          Request access
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "signup" && (
          <label className="block text-sm">
            Name
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label className="block text-sm">
          Email
          <Input
            className="mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          Password
          <Input
            className="mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
          />
          {mode === "signup" && (
            <span className="mt-1 block text-xs text-muted-foreground">At least 8 characters.</span>
          )}
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? mode === "signin"
              ? "Signing in..."
              : "Requesting access..."
            : mode === "signin"
              ? "Sign in"
              : "Request access"}
        </Button>
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground">
            Your request will be reviewed by an existing admin before you can access the dashboard.
          </p>
        )}
      </form>
    </div>
  );
}
