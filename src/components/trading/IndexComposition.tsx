"use client";

import { useTradeStore } from "@/hooks/useTradeStore";
import { MODERN_CARDS, VINTAGE_CARDS } from "@/lib/constants";

export function IndexComposition() {
  const { indexTab, setIndexTab } = useTradeStore();
  const cards = indexTab === "modern" ? MODERN_CARDS : VINTAGE_CARDS;

  return (
    <div className="bg-surface-card rounded-2xl border border-border shadow-card p-4 max-h-[260px] overflow-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-2.5">
        {(["modern", "vintage"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setIndexTab(t)}
            className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold font-body transition-all ${
              indexTab === t
                ? t === "modern"
                  ? "bg-[#00b4d8] text-white shadow-[0_0_12px_rgba(0,180,216,0.3)]"
                  : "bg-pkmn-yellow text-surface-base shadow-glow-yellow"
                : "bg-surface-elevated border border-border text-txt-dim hover:text-txt-mid"
            }`}
          >
            {t === "modern" ? `⚡ Modern (60%)` : `🏆 Vintage (40%)`}
          </button>
        ))}
      </div>

      {/* Card list */}
      {cards.map((card) => (
        <div
          key={card.tcgdexId}
          className="flex items-center gap-2 px-2.5 py-[7px] rounded-lg hover:bg-surface-elevated/50 transition-colors"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              card.tier === "modern" ? "bg-[#00e5ff]" : "bg-pkmn-yellow"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xs truncate">{card.name}</div>
            <div className="text-[9px] text-txt-dim font-semibold">{card.set}</div>
          </div>
          <div className="text-right">
            <div className="font-extrabold text-xs">
              {card.calPrice >= 1000
                ? `$${(card.calPrice / 1000).toFixed(1)}K`
                : `$${card.calPrice.toFixed(2)}`}
            </div>
            <div
              className={`text-[10px] font-bold ${
                card.change >= 0 ? "text-bull" : "text-bear"
              }`}
            >
              {card.change >= 0 ? "▲" : "▼"} {Math.abs(card.change)}%
            </div>
          </div>
          <div className="bg-surface-elevated rounded-xl px-2 py-0.5 text-[9px] font-extrabold text-txt-mid border border-border">
            {(card.weight * 100).toFixed(0)}%
          </div>
          <div
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
              card.source === "cardmarket"
                ? "bg-purple-500/10 text-purple-400"
                : "bg-green-500/10 text-green-400"
            }`}
          >
            {card.source === "cardmarket" ? "CM" : "TCG"}
          </div>
        </div>
      ))}
    </div>
  );
}
