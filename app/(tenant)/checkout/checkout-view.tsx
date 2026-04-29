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
  const [email, setEmail] = useState(initialEmail);
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
          customerEmail: email || undefined,
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
      <div className="mx-auto max-w-xl py-6 md:py-8">
        <h1 className="mb-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
          Payment
        </h1>
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
    <div className="mx-auto max-w-xl space-y-5 py-6 md:py-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A few details and we&apos;ll send your order to the kitchen.
        </p>
      </div>
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
          Email
          <Input
            className="mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            We&apos;ll send your receipt here.
          </span>
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
      <div className="flex items-center justify-between border-t-2 border-foreground pt-4">
        <span className="font-display text-lg font-semibold">Total</span>
        <span className="font-display text-lg font-bold tabular-nums">
          {formatMoney(total)}
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        className="w-full"
        size="lg"
        disabled={submitting || !name || !phone || !email}
        onClick={startPayment}
      >
        {submitting ? "Preparing payment..." : "Continue to payment"}
      </Button>
    </div>
  );
}
