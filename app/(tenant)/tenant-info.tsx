"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, MapPin, Phone } from "lucide-react";
import {
  DAY_FULL,
  formatTime,
  groupByDay,
  openStatus,
  parseHours,
} from "@/lib/tenant/hours";
import { cn } from "@/lib/utils";

type Props = {
  tenant: {
    address: string | null;
    phone: string | null;
    businessHours: unknown;
    googleMapsUrl?: string | null;
  };
};

export function TenantInfo({ tenant }: Props) {
  const hours = parseHours(tenant.businessHours);
  const hasAny = tenant.address || tenant.phone || hours.length > 0;
  if (!hasAny) return null;

  const status = hours.length > 0 ? openStatus(hours) : null;
  const todayDay = new Date().getDay();

  return <InfoBox tenant={tenant} hours={hours} status={status} todayDay={todayDay} />;
}

function InfoBox({
  tenant,
  hours,
  status,
  todayDay,
}: {
  tenant: Props["tenant"];
  hours: ReturnType<typeof parseHours>;
  status: { open: boolean; label: string } | null;
  todayDay: number;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <section className="mt-6 md:mt-8">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {/* Mobile collapsed summary — visible only when NOT expanded. */}
        <button
          type="button"
          onClick={() => setMobileExpanded(true)}
          aria-expanded={mobileExpanded}
          className={cn(
            "flex w-full items-center justify-between gap-3 p-3 text-left md:hidden",
            mobileExpanded && "hidden",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {tenant.address && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{tenant.address}</span>
              </span>
            )}
            {status && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] font-medium",
                  status.open
                    ? "bg-green-50 text-green-700"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {status.label}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {/* Full body — always on desktop, replaces the summary on mobile when expanded. */}
        <div
          className={cn(
            "relative grid-cols-1 gap-4 p-4 md:grid md:grid-cols-[1fr_1.1fr] md:gap-6 md:p-5",
            mobileExpanded ? "grid" : "hidden md:grid",
          )}
        >
          {/* Mobile-only collapse affordance in top-right. */}
          <button
            type="button"
            onClick={() => setMobileExpanded(false)}
            aria-label="Collapse"
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <ChevronUp className="h-4 w-4" />
          </button>

          <div className="space-y-4">
            {tenant.address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">Address</p>
                  <p className="mt-0.5 text-muted-foreground">{tenant.address}</p>
                  <a
                    href={
                      tenant.googleMapsUrl ||
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs underline hover:no-underline"
                  >
                    Get directions
                  </a>
                </div>
              </div>
            )}

            {tenant.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">Phone</p>
                  <a
                    href={`tel:${tenant.phone.replace(/[^\d+]/g, "")}`}
                    className="mt-0.5 block text-muted-foreground hover:text-foreground"
                  >
                    {tenant.phone}
                  </a>
                </div>
              </div>
            )}

            {hours.length > 0 && (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Hours</p>
                    {status && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          status.open
                            ? "bg-green-50 text-green-700"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {status.label}
                      </span>
                    )}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {groupByDay(hours).map(({ day, slots }) => (
                      <li
                        key={day}
                        className={cn(
                          "grid grid-cols-[80px_1fr] text-muted-foreground",
                          day === todayDay && "text-foreground",
                        )}
                      >
                        <span>{DAY_FULL[day]}</span>
                        <span>
                          {slots.length === 0
                            ? "Closed"
                            : slots
                                .map((s) => `${formatTime(s.open)} – ${formatTime(s.close)}`)
                                .join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {tenant.address && (
            <div className="min-h-[200px] overflow-hidden rounded-md border border-border md:min-h-[260px]">
              <iframe
                title="Map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(tenant.address)}&output=embed`}
                width="100%"
                height="100%"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
