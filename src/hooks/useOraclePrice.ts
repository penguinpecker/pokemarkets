"use client";
import { useState, useEffect, useCallback, useRef } from "react";
interface OraclePrice { price: number; confidence: number; timestamp: number; source: "switchboard" | "api" | "none"; stale: boolean; }
export function useOraclePrice() {
  const [oraclePrice, setOraclePrice] = useState<OraclePrice>({ price: 0, confidence: 0, timestamp: 0, source: "none", stale: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/oracle/pkmn-index", { cache: "no-store" });
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      const now = Date.now();
      setOraclePrice({ price: data.result || data.index || 0, confidence: data.confidence || 0, timestamp: data.timestamp || now, source: "api", stale: (now - (data.timestamp || now)) > 120000 });
      setError(null);
    } catch (err: any) { setError(err.message); setOraclePrice((prev) => ({ ...prev, stale: true }));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchPrice(); intervalRef.current = setInterval(fetchPrice, 5000); return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, [fetchPrice]);
  return { oraclePrice, loading, error, refetch: fetchPrice };
}
