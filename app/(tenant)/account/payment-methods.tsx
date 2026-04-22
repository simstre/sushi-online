"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}

type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export function PaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoadError(null);
    try {
      const res = await fetch("/api/account/payment-methods");
      const body = await safeJson(res);
      if (!res.ok) {
        const raw = body?.error ?? `Failed to load (${res.status})`;
        // Normalize unconfigured-Stripe errors into a friendlier message.
        const msg = /Invalid API Key|sk_test_\.\.\.|No API key|Unauthorized/i.test(raw)
          ? "Saved cards are unavailable until Stripe is configured on this tenant."
          : raw;
        setMethods([]);
        setLoadError(msg);
        return;
      }
      setMethods(body.paymentMethods ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteMethod(id: string) {
    if (!confirm("Remove this card?")) return;
    const res = await fetch(`/api/account/payment-methods/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert(await res.text());
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/account/payment-methods/${id}`, { method: "PATCH" });
    if (res.ok) load();
    else alert(await res.text());
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Payment methods</h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add card
        </Button>
      </div>

      {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}

      {methods === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : methods.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No saved cards. Add one for faster checkout.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium capitalize">
                    {m.brand} •••• {m.last4}
                    {m.isDefault && (
                      <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                        Default
                      </span>
                    )}
                  </p>
                  {m.expMonth && m.expYear && (
                    <p className="text-xs text-muted-foreground">
                      Expires {String(m.expMonth).padStart(2, "0")}/{m.expYear}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!m.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => setDefault(m.id)}>
                    Set default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMethod(m.id)}
                  aria-label="Remove card"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddCardDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </section>
  );
}

function AddCardDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/account/payment-methods", { method: "POST" });
      const body = await safeJson(res);
      if (!res.ok) {
        setError(body?.error ?? `Failed to start (${res.status})`);
        return;
      }
      setClientSecret(body.clientSecret);
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Add card</h3>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {!clientSecret && !error && (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        )}
        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            <AddCardForm onClose={onClose} onAdded={onAdded} />
          </Elements>
        )}
        {(!clientSecret || error) && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCardForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Failed to save card");
      return;
    }
    onAdded();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || busy}>
          {busy ? "Saving…" : "Save card"}
        </Button>
      </div>
    </form>
  );
}
