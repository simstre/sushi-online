"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  currentSlugFromPath,
  tenantPath,
} from "@/lib/tenant/client-url";

function menuHref(categoryId: string): string {
  const slug =
    typeof window !== "undefined"
      ? currentSlugFromPath(window.location.pathname)
      : null;
  return tenantPath(`/menu/${categoryId}`, slug);
}

type Category = { id: string; name: string; count: number };

/**
 * Click-to-scroll navigation for the single-scroll menu page. Clicking a
 * category smooth-scrolls to its `#cat-<id>` section and replaces the URL
 * without navigating; IntersectionObserver keeps the active state in sync
 * as the user scrolls through sections.
 */
function useActiveSection(initialActiveId: string): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState(initialActiveId);

  useEffect(() => {
    setActiveId(initialActiveId);
  }, [initialActiveId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^cat-/, "");
          setActiveId(id);
          // Keep URL in sync with the section actually being read.
          window.history.replaceState(null, "", menuHref(id));
        }
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    const sections = document.querySelectorAll<HTMLElement>('[id^="cat-"]');
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return [activeId, setActiveId];
}

function scrollToCategory(id: string, setActive: (id: string) => void) {
  const el = document.getElementById(`cat-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", menuHref(id));
  setActive(id);
}

/** Mobile: horizontal scrolling chips with edge scroll indicators. */
export function CategoryChipsMobile({
  categories,
  activeId: initialActiveId,
}: {
  categories: Category[];
  activeId: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeId, setActiveId] = useActiveSection(initialActiveId);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [categories.length]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  function nudge(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className="sticky top-14 z-10 -mx-4 border-b border-border bg-background/95 backdrop-blur md:hidden">
      <div className="relative">
        <div
          ref={scrollerRef}
          className="scrollbar-none overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex px-4">
            {categories.map((c) => {
              const active = c.id === activeId;
              return (
                <a
                  key={c.id}
                  href={menuHref(c.id)}
                  ref={active ? activeRef : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToCategory(c.id, setActiveId);
                  }}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.name}
                </a>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-1 pr-6 bg-gradient-to-r from-background via-background/90 to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => nudge(-240)}
            aria-label="Scroll categories left"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 flex items-center pl-6 pr-1 bg-gradient-to-l from-background via-background/90 to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => nudge(240)}
            aria-label="Scroll categories right"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Desktop: vertical sticky sidebar. */
export function CategorySidebar({
  categories,
  activeId: initialActiveId,
}: {
  categories: Category[];
  activeId: string;
}) {
  const [activeId, setActiveId] = useActiveSection(initialActiveId);

  return (
    <nav className="hidden md:block">
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
        <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </h2>
        <ul className="space-y-0.5">
          {categories.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <a
                  href={menuHref(c.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToCategory(c.id, setActiveId);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary font-medium text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  <span
                    className={cn(
                      "ml-2 shrink-0 text-xs tabular-nums",
                      active ? "opacity-75" : "text-muted-foreground",
                    )}
                  >
                    {c.count}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
