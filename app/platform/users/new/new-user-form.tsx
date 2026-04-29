"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Restaurant = { id: string; label: string; slug: string };

type InviteResult = {
  emailSent: boolean;
  emailError?: string | null;
  inviteUrl: string;
};

export function NewUserForm({
  restaurants,
  initialRestaurantId = "",
}: {
  restaurants: Restaurant[];
  initialRestaurantId?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [restaurantId, setRestaurantId] = useState(initialRestaurantId);
  const [role, setRole] = useState<"admin" | "staff">("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/platform/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim() || undefined,
        restaurantId: restaurantId || undefined,
        role: restaurantId ? role : undefined,
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Invite failed");
      return;
    }
    setResult({
      emailSent: Boolean(body.emailSent),
      emailError: body.emailError ?? null,
      inviteUrl: body.inviteUrl,
    });
    setEmail("");
    setName("");
    setRestaurantId("");
    setRole("admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        Email
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </label>
      <label className="block text-sm">
        Name (optional)
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm">
        Restaurant access (optional)
        <select
          className="mt-1 flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
        >
          <option value="">— none —</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {restaurantId && (
        <label className="block text-sm">
          Role at this restaurant
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "staff")}
          >
            <option value="admin">Admin (full access)</option>
            <option value="staff">Staff</option>
          </select>
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {result.emailSent ? (
            <p className="font-medium">Invite email sent.</p>
          ) : (
            <>
              <p className="font-medium">Invite created.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Email not delivered{result.emailError ? ` (${result.emailError})` : ""}. Share this
                link directly:
              </p>
              <p className="mt-2 break-all rounded bg-background px-2 py-1 font-mono text-xs">
                {result.inviteUrl}
              </p>
            </>
          )}
        </div>
      )}
      <Button type="submit" disabled={busy || !email}>
        {busy ? "Sending invite..." : "Send invite"}
      </Button>
    </form>
  );
}
