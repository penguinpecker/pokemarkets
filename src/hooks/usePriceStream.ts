import { useQuery } from "@tanstack/react-query";
import type { IndexData } from "@/lib/types";

/**
 * Polls the /api/price endpoint for live index data.
 * In production, this would connect to a WebSocket or
 * subscribe to Switchboard feed updates via Solana.
 */
export function usePriceStream() {
  return useQuery<IndexData>({
    queryKey: ["pkmn-price"],
    queryFn: async () => {
      const res = await fetch("/api/price");
      if (!res.ok) throw new Error("Price fetch failed");
      const data = await res.json();
      return {
        value: data.index,
        modernComponent: data.modernComponent,
        vintageComponent: data.vintageComponent,
        confidence: data.confidence,
        timestamp: data.timestamp,
      };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
