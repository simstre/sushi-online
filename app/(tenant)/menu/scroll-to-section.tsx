"use client";

import { useEffect } from "react";

/**
 * On mount (or when `id` changes), scroll the section with id=`cat-<id>` into
 * view instantly. Used to deep-link a category URL like /menu/<id> on the
 * single-scroll menu page.
 */
export function ScrollToSection({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    // rAF so layout is settled before scrolling
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "auto", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return null;
}
