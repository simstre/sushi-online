import { Clock } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Props = {
  waitTimeMinutes: number | null;
  minOrder: number | null;
  currency: string;
};

/**
 * The "Order pickup" strip that anchors the menu page — matches the
 * WelcomeBanner pattern from the foodTemplate design package, intentionally
 * generic (no tenant name or address) so the headline reads the same on every
 * restaurant.
 *
 * Renders only the facts that exist; falls back gracefully when fields are
 * unset.
 */
export function PickupHeader({ waitTimeMinutes, minOrder, currency }: Props) {
  const facts: { icon: React.ReactNode; text: React.ReactNode; key: string }[] = [];

  if (waitTimeMinutes && waitTimeMinutes > 0) {
    facts.push({
      key: "wait",
      icon: <Clock className="h-3.5 w-3.5" />,
      text: <>~{waitTimeMinutes} min wait</>,
    });
  }
  if (minOrder && minOrder > 0) {
    facts.push({
      key: "min",
      icon: null,
      text: (
        <span className="font-semibold text-foreground">
          {formatMoney(minOrder, currency)} min order
        </span>
      ),
    });
  }

  return (
    <section className="mt-6 border-b border-border pb-5 md:mt-10 md:pb-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-foreground md:text-5xl">
        Order pickup
      </h1>
      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {facts.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1.5">
              {f.icon}
              {f.text}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
