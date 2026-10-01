"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767.98px)";

/**
 * True below Tailwind's `md` breakpoint. Starts `false` on the server and on
 * the first client render so SSR and hydration agree, then corrects in an
 * effect.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
