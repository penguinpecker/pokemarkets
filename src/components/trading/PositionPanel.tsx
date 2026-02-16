"use client";

import { useCallback, useState } from "react";
import { CardDeck } from "@/components/ui/CardDeck";
import { useTradeStore } from "@/hooks/useTradeStore";

const TABS = ["Positions", "Orders", "History"];

export function PositionPanel() {
  const {
    positions,
    closePosition,
    tradeHistory,
    metrics,
    deposited,

    liquidationLog,
  } = useTradeStore();

  const [activeTab, setActiveTab] = useState("Positions");
  const [closingId, setClosingId] = useState<string | null>(null);

  const handleClose = useCallback(
    (id: string) => {
      setClosingId(id);
      setTimeout(() => {
        closePosition(id);
        setClosingId(null);
      }, 300);
    },
    [closePosition]
  );

  return (
    <div className="bg-surface-card rounded-2xl border border-border shadow-card p-4">
      {/* Tabs */}
      <div className="flex gap-4 mb-3">
        {TABS.map((t) => (
          <span
            key={t}
            onClick={() => setActiveTab(t)}
            className={`text-xs font-extrabold cursor-pointer pb-1 transition-colors ${
              activeTab === t
                ? "text-pkmn-yellow border-b-[3px] border-pkmn-red"
                : "text-txt-dim hover:text-txt-mid"
            }`}
          >
            {t}
            {t === "Positions" && positions.length > 0 && (
              <span className="ml-1.5 bg-pkmn-red/20 text-pkmn-red text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {positions.length}
              </span>
            )}
            {t === "History" && tradeHistory.length > 0 && (
              <span className="ml-1.5 bg-surface-elevated text-txt-dim text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {tradeHistory.length}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Account summary bar */}
      {positions.length > 0 && activeTab === "Positions" && (
        <div className="flex gap-3 mb-3 text-[10px]">
          <div className="flex-1 bg-surface-elevated rounded-lg px-2.5 py-1.5 border border-border">
            <div className="text-txt-dim font-bold">Equity</div>
            <div className="text-pkmn-yellow font-extrabold text-xs">
              ${metrics.equity.toFixed(2)}
            </div>
          </div>
          <div className="flex-1 bg-surface-elevated rounded-lg px-2.5 py-1.5 border border-border">
            <div className="text-txt-dim font-bold">Margin Used</div>
            <div className="text-txt-primary font-extrabold text-xs">
              ${metrics.totalInitialMargin.toFixed(2)}
            </div>
          </div>
          <div className="flex-1 bg-surface-elevated rounded-lg px-2.5 py-1.5 border border-border">
            <div className="text-txt-dim font-bold">Acct Lev.</div>
            <div className={`font-extrabold text-xs ${
              metrics.accountLeverage > 4 ? "text-bear" : metrics.accountLeverage > 2 ? "text-pkmn-yellow" : "text-txt-primary"
            }`}>
              {metrics.accountLeverage.toFixed(2)}x
            </div>
          </div>
        </div>
      )}

      {/* Liquidation alerts */}
      {liquidationLog.length > 0 && activeTab === "Positions" && (
        <div className="mb-2 bg-bear/5 border border-bear/15 rounded-lg p-2 max-h-[60px] overflow-y-auto">
          {liquidationLog.slice(0, 3).map((msg, i) => (
            <div key={i} className="text-[9px] text-bear font-bold">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Margin health warning */}
      {positions.length > 0 && metrics.marginRatio > 0.7 && activeTab === "Positions" && (
        <div className={`mb-2 text-[10px] font-bold px-3 py-1.5 rounded-lg border ${
          metrics.marginRatio > 0.9
            ? "bg-bear/10 text-bear border-bear/20 animate-pulse"
            : "bg-pkmn-yellow/10 text-pkmn-yellow border-pkmn-yellow/20"
        }`}>
          {metrics.marginRatio > 0.9
            ? "⚠ DANGER — Approaching liquidation! Reduce positions or add collateral."
            : "⚠ Margin health low — consider reducing exposure."}
        </div>
      )}

      {/* Empty state */}
      {activeTab === "Positions" && positions.length === 0 && (
        <div className="text-center py-5 flex flex-col items-center gap-2">
          <CardDeck size={34} />
          {deposited > 0 ? (
            <>
              <span className="text-txt-mid font-bold text-[13px]">No open positions</span>
              <span className="text-txt-dim text-[11px]">
                Open a PKMN-PERP position to start trading
              </span>
            </>
          ) : (
            <>
              <span className="text-txt-mid font-bold text-[13px]">Deposit to start</span>
              <span className="text-txt-dim text-[11px]">
                Deposit collateral in the trade panel to begin
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Positions ────────────────────────────────────── */}
      {activeTab === "Positions" &&
        positions.map((pos) => {
          const pnlColor = pos.unrealizedPnl >= 0 ? "text-bull" : "text-bear";
          const timeOpen = Date.now() - pos.timestamp;
          const timeStr =
            timeOpen < 60000
              ? `${Math.floor(timeOpen / 1000)}s`
              : timeOpen < 3600000
                ? `${Math.floor(timeOpen / 60000)}m`
                : `${(timeOpen / 3600000).toFixed(1)}h`;

          // Per-position equity check
          const posEquity = pos.collateral + pos.unrealizedPnl - pos.realizedFunding;
          const posHealth = pos.collateral > 0
            ? Math.max(0, Math.min(1, (posEquity - pos.maintenanceMargin) / (pos.collateral - pos.maintenanceMargin)))
            : 0;

          return (
            <div
              key={pos.id}
              className={`bg-surface-elevated rounded-xl p-3.5 border mt-2 transition-all ${
                closingId === pos.id ? "opacity-50 border-border" :
                posHealth < 0.2 ? "border-bear/30 animate-pulse" : "border-border animate-slide-up"
              }`}
            >
              {/* Header row */}
              <div className="flex justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      pos.side === "long"
                        ? "bg-bull/10 text-bull border-bull/20"
                        : "bg-bear/10 text-bear border-bear/20"
                    }`}
                  >
                    {pos.side.toUpperCase()} {pos.leverage.toFixed(1)}x
                  </span>
                  <span className="font-extrabold text-xs">PKMN-PERP</span>
                  <span className="text-[8px] text-cyan-400 bg-cyan-400/5 px-1.5 py-0.5 rounded font-bold border border-cyan-400/10">
                    PAPER
                  </span>
                </div>
                <button
                  onClick={() => handleClose(pos.id)}
                  disabled={closingId === pos.id}
                  className="bg-pkmn-red-glow border border-pkmn-red/20 text-pkmn-red px-3 py-0.5 rounded-full text-[10px] font-extrabold font-body hover:bg-pkmn-red/15 transition-colors disabled:opacity-50"
                >
                  {closingId === pos.id ? "Closing..." : "Close ✕"}
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    k: "SIZE",
                    v: `$${pos.notional.toFixed(0)}`,
                    sub: `${pos.sizeIndex.toFixed(2)} idx`,
                  },
                  { k: "ENTRY", v: `$${pos.entryPrice.toFixed(2)}` },
                  { k: "MARK", v: `$${pos.markPrice.toFixed(2)}` },
                  {
                    k: "uPnL",
                    v: `${pos.unrealizedPnl >= 0 ? "+" : ""}$${pos.unrealizedPnl.toFixed(2)}`,
                    sub: `${pos.unrealizedPnlPercent >= 0 ? "+" : ""}${pos.unrealizedPnlPercent.toFixed(1)}%`,
                    color: pnlColor,
                  },
                ].map((r) => (
                  <div key={r.k}>
                    <div className="text-[9px] text-txt-dim font-bold uppercase">{r.k}</div>
                    <div className={`font-extrabold text-[13px] ${r.color || "text-txt-primary"}`}>
                      {r.v}
                    </div>
                    {r.sub && (
                      <div className={`text-[9px] font-bold ${r.color || "text-txt-dim"}`}>
                        {r.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Margin details */}
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px]">
                <div className="bg-surface-input rounded px-2 py-1 border border-border">
                  <div className="text-txt-dim font-bold">Collateral</div>
                  <div className="text-txt-primary font-extrabold">${pos.collateral.toFixed(2)}</div>
                </div>
                <div className="bg-surface-input rounded px-2 py-1 border border-border">
                  <div className="text-txt-dim font-bold">Maint. Margin</div>
                  <div className="text-txt-primary font-extrabold">${pos.maintenanceMargin.toFixed(2)}</div>
                </div>
                <div className="bg-surface-input rounded px-2 py-1 border border-border">
                  <div className="text-txt-dim font-bold">Funding</div>
                  <div className={`font-extrabold ${pos.realizedFunding >= 0 ? "text-bear" : "text-bull"}`}>
                    {pos.realizedFunding >= 0 ? "-" : "+"}${Math.abs(pos.realizedFunding).toFixed(3)}
                  </div>
                </div>
              </div>

              {/* Liq price bar */}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-txt-dim font-bold">Liq. Price</span>
                  <span className="text-bear font-extrabold">
                    ${pos.liquidationPrice.toFixed(2)}
                  </span>
                </div>
                {/* Visual distance to liquidation */}
                <div className="h-1 bg-surface-input rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      posHealth < 0.2 ? "bg-bear" : posHealth < 0.5 ? "bg-pkmn-yellow" : "bg-bull"
                    }`}
                    style={{ width: `${Math.max(2, posHealth * 100)}%` }}
                  />
                </div>
              </div>

              {/* Footer: fee + time */}
              <div className="mt-1.5 flex justify-between text-[9px] text-txt-dim">
                <span>Fee: ${pos.openFee.toFixed(3)}</span>
                <span>Open {timeStr}</span>
              </div>
            </div>
          );
        })}

      {/* ── Orders tab ───────────────────────────────────── */}
      {activeTab === "Orders" && (
        <div className="text-center py-5 flex flex-col items-center gap-2">
          <span className="text-txt-mid font-bold text-[13px]">No open orders</span>
          <span className="text-txt-dim text-[11px]">
            Limit & stop orders coming with on-chain integration
          </span>
        </div>
      )}

      {/* ── History tab ──────────────────────────────────── */}
      {activeTab === "History" && (
        <>
          {tradeHistory.length === 0 ? (
            <div className="text-center py-5 flex flex-col items-center gap-2">
              <span className="text-txt-mid font-bold text-[13px]">No trade history</span>
              <span className="text-txt-dim text-[11px]">
                Closed positions will appear here
              </span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {tradeHistory.map((trade) => {
                const pnlColor = trade.netPnl >= 0 ? "text-bull" : "text-bear";
                const timeStr = new Date(trade.closedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={trade.id}
                    className="bg-surface-elevated rounded-lg p-2.5 border border-border"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            trade.side === "long"
                              ? "bg-bull/10 text-bull"
                              : "bg-bear/10 text-bear"
                          }`}
                        >
                          {trade.side.toUpperCase()} {trade.leverage}x
                        </span>
                        <span className="text-[10px] text-txt-dim font-bold">
                          ${trade.notional.toFixed(0)}
                        </span>
                      </div>
                      <span className={`text-xs font-extrabold ${pnlColor}`}>
                        {trade.netPnl >= 0 ? "+" : ""}${trade.netPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-txt-dim mt-1">
                      <span>
                        ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                      </span>
                      <span>{timeStr}</span>
                    </div>
                    {/* Breakdown */}
                    <div className="flex gap-3 mt-1 text-[8px] text-txt-dim">
                      <span>Gross: ${trade.grossPnl.toFixed(2)}</span>
                      <span>Fees: -${trade.fees.toFixed(3)}</span>
                      {trade.funding !== 0 && (
                        <span>Fund: {trade.funding >= 0 ? "-" : "+"}${Math.abs(trade.funding).toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
