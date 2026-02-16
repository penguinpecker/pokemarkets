"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { MarketBar } from "@/components/layout/MarketBar";
import { Chart } from "@/components/trading/Chart";
import { OrderPanel } from "@/components/trading/OrderPanel";
import { PositionPanel } from "@/components/trading/PositionPanel";
import { IndexComposition } from "@/components/trading/IndexComposition";
import { Polyfills } from "@/components/ui/Polyfills";
import { useTradeStore } from "@/hooks/useTradeStore";
import { useOraclePrice } from "@/hooks/useOraclePrice";

export default function TradingPageInner() {
  const tick = useTradeStore((s) => s.tick);
  const setLivePrice = useTradeStore((s) => s.setLivePrice);
  const { oraclePrice } = useOraclePrice();

  // Seed store with oracle price when it arrives
  useEffect(() => {
    if (oraclePrice.price > 0 && oraclePrice.source !== "none") {
      setLivePrice(oraclePrice.price);
    }
  }, [oraclePrice.price, oraclePrice.source, setLivePrice]);

  // Engine tick every 2s — updates price, PnL, funding, liquidations
  useEffect(() => {
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [tick]);

  return (
    <>
      <Polyfills />
      <div className="min-h-screen bg-surface-base">
        <Header />
        <MarketBar />

        <main className="grid grid-cols-[1fr_340px] gap-3 p-3 max-w-[1400px] mx-auto">
          <div className="flex flex-col gap-3">
            <Chart />
            <div className="grid grid-cols-2 gap-3">
              <PositionPanel />
              <IndexComposition />
            </div>
          </div>

          <OrderPanel />
        </main>
      </div>
    </>
  );
}
