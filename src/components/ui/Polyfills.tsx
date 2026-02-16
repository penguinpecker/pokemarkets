"use client";

import { useEffect } from "react";
import { Buffer } from "buffer";

/**
 * Polyfills required for Drift SDK / Anchor in the browser.
 * Must be rendered before any Drift code runs.
 */
export function Polyfills() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).Buffer = Buffer;
      (window as any).process = (window as any).process || { env: {} };
    }
  }, []);
  return null;
}
