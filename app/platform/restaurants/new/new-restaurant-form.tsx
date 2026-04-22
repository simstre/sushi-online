"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewRestaurantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/create-restaurant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        locationName: locationName.trim() || undefined,
        slug: slug.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
      }),
    });

    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Create failed" }));
      setError(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
      return;
    }
    const body = await res.json();
    setResult({ url: body.url });
  }

  if (result) {
    return (
      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-medium">Restaurant created.</p>
        <p>
          Live at:{" "}
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline">
            {result.url}
          </a>
        </p>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => router.push("/platform/restaurants")}>
            Back to list
          </Button>
          <Button variant="outline" onClick={() => setResult(null)}>
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        Brand / restaurant name
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label className="block text-sm">
        Location (optional)
        <Input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Leave blank for single-location restaurants"
        />
      </label>
      <label className="block text-sm">
        Slug
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          required
          placeholder="lowercase-dashes-only"
          pattern="[a-z0-9-]+"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Tenant will live at https://{slug || "<slug>"}.
          {process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000"}
        </span>
      </label>
      <label className="block text-sm">
        Owner email (optional)
        <Input
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          type="email"
          placeholder="If provided and the user exists, they'll be linked as tenant admin"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !name || !slug}>
        {busy ? "Creating..." : "Create restaurant"}
      </Button>
    </form>
  );
}
