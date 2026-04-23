"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutForm } from "./checkout-form";
import { useCart } from "@/lib/stores/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

export function CheckoutView({
  initialName = "",
  initialEmail = "",
}: {
  initialName?: string;
  initialEmail?: string;
}) {
  const items = useCart((s) => s.items);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items],
  );

  async function startPayment() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            modifiers: i.modifiers,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Unable to start payment");
      const data = await res.json();
      setClientSecret(data.clientSecret);
      setOrderId(data.orderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0 && !clientSecret) {
    return (
      <p className="mx-auto max-w-md py-12 text-center text-muted-foreground">
        Your cart is empty.
      </p>
    );
  }

  if (clientSecret && orderId) {
    return (
      <div className="mx-auto max-w-xl py-4 md:py-6">
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "stripe" } }}
        >
          <CheckoutForm orderId={orderId} />
        </Elements>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 md:py-6">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      {initialEmail && (
        <p className="text-sm text-muted-foreground">
          Ordering as <span className="font-medium">{initialEmail}</span>
        </p>
      )}
      <div className="space-y-3">
        <label className="block text-sm">
          Name
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          Phone
          <Input
            className="mt-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="font-medium">Total</span>
        <span className="font-semibold">{formatMoney(total)}</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        className="w-full"
        size="lg"
        disabled={submitting || !name || !phone}
        onClick={startPayment}
      >
        {submitting ? "Preparing payment..." : "Continue to payment"}
      </Button>
    </div>
  );
}
