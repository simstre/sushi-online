"use client";

import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/stores/cart";
import { currentSlugFromPath, tenantPath } from "@/lib/tenant/client-url";

export function CheckoutForm({ orderId }: { orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const clear = useCart((s) => s.clear);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const origin = window.location.origin;
    const slug = currentSlugFromPath(window.location.pathname);
    const returnPath = tenantPath(`/confirmation?orderId=${orderId}`, slug);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${origin}${returnPath}`,
      },
    });

    if (error) {
      setError(error.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }

    // Happy path: Stripe redirects to return_url. Clear cart on the way out.
    clear();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <h1 className="text-2xl font-semibold">Payment</h1>
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={!stripe || submitting}>
        {submitting ? "Processing..." : "Pay now"}
      </Button>
    </form>
  );
}
