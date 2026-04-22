"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";
import { HoursEditor } from "./hours-editor";
import { parseHours, type BusinessHours } from "@/lib/tenant/hours";

type Tenant = {
  id: string;
  name: string;
  locationName: string | null;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  currency: string;
  stripeAccountId: string | null;
  externalStripeAccountId: string | null;
  address: string | null;
  phone: string | null;
  businessHours: unknown;
};

export function SettingsForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [form, setForm] = useState(tenant);
  const [hours, setHours] = useState<BusinessHours>(parseHours(tenant.businessHours));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Tenant>(key: K, value: Tenant[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/create-restaurant?id=${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, businessHours: hours }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="grid max-w-xl grid-cols-1 gap-5">
      <label className="text-sm">
        Brand / restaurant name
        <Input
          className="mt-1"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </label>
      <label className="text-sm">
        Location
        <Input
          className="mt-1"
          value={form.locationName ?? ""}
          onChange={(e) => update("locationName", e.target.value || null)}
          placeholder="e.g. Downtown, Richmond Hill (leave blank if single location)"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Shows as &quot;{form.name}
          {form.locationName ? ` - ${form.locationName}` : ""}&quot; in the header.
        </span>
      </label>

      <ImageUpload
        label="Logo"
        prefix={`restaurants/${form.slug}/logo`}
        value={form.logoUrl}
        onChange={(url) => update("logoUrl", url)}
      />

      <ImageUpload
        label="Banner"
        prefix={`restaurants/${form.slug}/banner`}
        aspect="banner"
        value={form.bannerUrl}
        onChange={(url) => update("bannerUrl", url)}
      />

      <label className="text-sm">
        Address
        <Input
          className="mt-1"
          value={form.address ?? ""}
          onChange={(e) => update("address", e.target.value || null)}
          placeholder="123 Main St, City, Region, Postal"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Also used for the embedded map on the storefront.
        </span>
      </label>

      <label className="text-sm">
        Phone
        <Input
          className="mt-1"
          value={form.phone ?? ""}
          onChange={(e) => update("phone", e.target.value || null)}
          placeholder="(604) 555-0199"
        />
      </label>

      <HoursEditor value={hours} onChange={setHours} />

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Primary color
          <Input
            className="mt-1"
            type="color"
            value={form.primaryColor ?? "#111111"}
            onChange={(e) => update("primaryColor", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Secondary color
          <Input
            className="mt-1"
            type="color"
            value={form.secondaryColor ?? "#f4f4f5"}
            onChange={(e) => update("secondaryColor", e.target.value)}
          />
        </label>
      </div>

      <label className="text-sm">
        Currency
        <Input
          className="mt-1"
          value={form.currency}
          onChange={(e) => update("currency", e.target.value.toUpperCase())}
        />
      </label>

      <label className="text-sm">
        Stripe Connect Account ID
        <Input
          className="mt-1"
          value={form.stripeAccountId ?? ""}
          onChange={(e) => update("stripeAccountId", e.target.value || null)}
          placeholder="acct_..."
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          When set, payments route through this Connect account.
        </span>
      </label>

      {form.externalStripeAccountId && (
        <div className="text-sm">
          <p>Source Stripe account (reference only)</p>
          <Input
            className="mt-1"
            value={form.externalStripeAccountId}
            readOnly
            disabled
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Scraped from the source platform for this location. Not used for payment
            processing — kept for future migration reference.
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
