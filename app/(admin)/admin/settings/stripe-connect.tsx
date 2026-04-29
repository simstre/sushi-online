"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  hasAccount: boolean;
  chargesEnabled: boolean;
};

type Status = {
  state: "not-connected" | "pending" | "ready";
  caption: string;
};

function statusFor(props: Props): Status {
  if (!props.hasAccount) {
    return {
      state: "not-connected",
      caption:
        "Stripe isn't connected yet. Until it is, payments fall back to the platform account.",
    };
  }
  if (props.chargesEnabled) {
    return {
      state: "ready",
      caption: "Stripe is connected and ready to accept payments.",
    };
  }
  return {
    state: "pending",
    caption:
      "Stripe account created but onboarding isn't finished. Resume the form to complete it.",
  };
}

export function StripeConnect(props: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<"connect" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const status = statusFor(props);

  // Auto-refresh once when the user returns from the Stripe-hosted onboarding.
  useEffect(() => {
    const flag = params.get("stripe");
    if (flag !== "return" && flag !== "refresh") return;
    void refresh({ silent: true, clearQuery: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startOrResume() {
    setBusy("connect");
    setError(null);
    const res = await fetch("/api/admin/stripe/connect", { method: "POST" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error ?? "Could not start Stripe onboarding");
      setBusy(null);
      return;
    }
    const body = (await res.json()) as { url: string };
    window.location.href = body.url;
  }

  async function refresh(opts: { silent?: boolean; clearQuery?: boolean } = {}) {
    if (!opts.silent) setBusy("refresh");
    setError(null);
    const res = await fetch("/api/admin/stripe/refresh", { method: "POST" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (!opts.silent) setError(e?.error ?? "Refresh failed");
      setBusy(null);
      return;
    }
    setBusy(null);
    if (opts.clearQuery) {
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.toString());
    }
    startTransition(() => router.refresh());
  }

  const pillClass =
    status.state === "ready"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status.state === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-muted text-muted-foreground ring-border";

  const pillLabel =
    status.state === "ready"
      ? "Connected · charges enabled"
      : status.state === "pending"
        ? "Stripe onboarding in progress"
        : "Not connected";

  const primaryLabel = !props.hasAccount
    ? "Connect Stripe"
    : props.chargesEnabled
      ? "Update Stripe details"
      : "Resume Stripe onboarding";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${pillClass}`}
        >
          {pillLabel}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{status.caption}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={startOrResume} disabled={busy !== null}>
          {busy === "connect" ? "Opening Stripe..." : primaryLabel}
        </Button>
        {props.hasAccount && (
          <Button
            variant="outline"
            onClick={() => refresh()}
            disabled={busy !== null}
          >
            {busy === "refresh" ? "Refreshing..." : "Refresh status"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
