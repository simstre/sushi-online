"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Restaurant = { id: string; label: string; slug: string };

export function NewUserForm({ restaurants }: { restaurants: Restaurant[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [restaurantId, setRestaurantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim() || undefined,
        password,
        isSuperAdmin,
        restaurantId: restaurantId || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Create failed" }));
      setError(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
      return;
    }
    router.push("/platform/users");
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
        Initial password
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Share securely with the user; they can change it from /account.
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isSuperAdmin}
          onChange={(e) => setIsSuperAdmin(e.target.checked)}
        />
        Grant platform superadmin
      </label>
      <label className="block text-sm">
        Restaurant admin for (optional)
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !email || !password}>
        {busy ? "Creating..." : "Create user"}
      </Button>
    </form>
  );
}
