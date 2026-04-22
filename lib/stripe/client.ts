import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Surface a loud error in dev rather than letting Stripe() throw a cryptic one.
  console.warn("STRIPE_SECRET_KEY is not set — payment routes will fail.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "REDACTED_SECRET", {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});
