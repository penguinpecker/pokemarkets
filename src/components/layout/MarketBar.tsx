"use client";

import { useTradeStore } from "@/hooks/useTradeStore";
import { getMockMarketStats } from "@/lib/constants";

export function MarketBar() {
  const livePrice = useTradeStore((s) => s.livePrice);
  const stats = getMockMarketStats(livePrice);

  const items = [
    {
      label: "24h Change",
      value: `${stats.change24h >= 0 ? "+" : ""}${stats.change24h.toFixed(2)}%`,
      color: stats.change24h >= 0 ? "text-bull" : "text-bear",
    },
    { label: "24h High", value: `$${stats.high24h.toFixed(2)}` },
    { label: "24h Low", value: `$${stats.low24h.toFixed(2)}` },
    { label: "Open Interest", value: `$${(stats.openInterest / 1000).toFixed(1)}K` },
    { label: "Funding", value: `+${stats.fundingRate.toFixed(4)}%`, color: "text-bull" },
    { label: "Volume", value: `$${(stats.volume24h / 1000000).toFixed(1)}M` },
  ];

  return (
    <div className="flex items-center gap-7 px-6 py-3 bg-surface-card border-b border-border">
      {/* Token icon */}
      <div className="flex items-center gap-2.5">
        <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-pkmn-red to-[#FF2222] flex items-center justify-center text-lg border-2 border-pkmn-yellow shadow-[0_0_16px_rgba(232,0,13,0.3)]">
          🔥
        </div>
        <div>
          <div className="font-black text-base text-txt-primary">PKMN-INDEX</div>
          <div className="text-[10px] text-txt-dim font-semibold">Perpetual · v3.0 · Solana</div>
        </div>
      </div>

      {/* Live price */}
      <div className="text-[26px] font-black text-pkmn-yellow drop-shadow-[0_0_20px_rgba(255,203,5,0.2)]">
        ${livePrice.toFixed(2)}
      </div>

      {/* Stats */}
      {items.map((item) => (
        <div key={item.label}>
          <div className="text-[9px] text-txt-dim font-bold uppercase tracking-wider mb-0.5">
            {item.label}
          </div>
          <div className={`text-sm font-extrabold ${item.color || "text-txt-primary"}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
