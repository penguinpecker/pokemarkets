"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp, ColorType, CrosshairMode } from "lightweight-charts";
import { useTradeStore } from "@/hooks/useTradeStore";

const TIMEFRAMES = ["1H", "4H", "1D", "1W"];

export function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const { candles, livePrice, chartTab, setChartTab, timeframe, setTimeframe } = useTradeStore();

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5A5C70",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,203,5,0.03)" },
        horzLines: { color: "rgba(255,203,5,0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,203,5,0.2)", width: 1, style: 2, labelBackgroundColor: "#FFCB05" },
        horzLine: { color: "rgba(255,203,5,0.2)", width: 1, style: 2, labelBackgroundColor: "#FFCB05" },
      },
      rightPriceScale: {
        borderColor: "#252738",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#252738",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#E8000D",
      downColor: "#12131f",
      borderUpColor: "#E8000D",
      borderDownColor: "#FFCB05",
      wickUpColor: "#E8000D",
      wickDownColor: "#FFCB05",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData = candles.map((c) => ({
      time: Math.floor(c.time / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: Math.floor(c.time / 1000) as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? "rgba(232,0,13,0.25)" : "rgba(255,203,5,0.12)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
  }, [candles]);

  // Live price update
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;
    const last = candles[candles.length - 1];
    candleSeriesRef.current.update({
      time: Math.floor(last.time / 1000) as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    });
  }, [livePrice, candles]);

  const lastCandle = candles[candles.length - 1];

  return (
    <div className="bg-surface-card rounded-2xl border border-border shadow-card overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center px-4 py-2.5 border-b border-border gap-1">
        {(
          [
            { key: "chart", label: "📊 Chart" },
            { key: "info", label: "📋 Index" },
            { key: "oracle", label: "⚡ Oracle" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setChartTab(t.key)}
            className={`px-3.5 py-1 rounded-full text-xs font-bold font-body transition-colors ${
              chartTab === t.key
                ? "bg-surface-elevated border border-border-light text-pkmn-yellow"
                : "border border-transparent text-txt-dim hover:text-txt-mid"
            }`}
          >
            {t.label}
          </button>
        ))}

        <div className="flex-1" />

        {chartTab === "chart" && (
          <div className="flex gap-0.5 bg-surface-elevated rounded-full p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold font-body transition-all ${
                  timeframe === tf
                    ? "bg-pkmn-red text-white shadow-glow-red"
                    : "text-txt-dim hover:text-txt-mid"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {chartTab === "chart" && (
          <div className="relative">
            {/* OHLC overlay */}
            <div className="absolute top-1 left-1 z-10 flex gap-2.5 text-[10px]">
              {[
                { k: "O", v: lastCandle?.open.toFixed(2) },
                { k: "H", v: lastCandle?.high.toFixed(2) },
                { k: "L", v: lastCandle?.low.toFixed(2) },
                { k: "C", v: livePrice.toFixed(2) },
              ].map((x) => (
                <span key={x.k} className="text-txt-dim">
                  {x.k}{" "}
                  <span className="text-pkmn-red font-bold">{x.v}</span>
                </span>
              ))}
            </div>
            <div ref={chartContainerRef} className="w-full h-[370px]" />
          </div>
        )}

        {chartTab === "info" && <IndexInfo />}
        {chartTab === "oracle" && <OracleView price={livePrice} />}
      </div>
    </div>
  );
}

// ============================================================================
// INDEX INFO TAB
// ============================================================================
function IndexInfo() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="text-[11px] text-txt-dim font-bold uppercase tracking-wider mb-2.5">
          Index Composition — v3.0
        </div>
        <div className="flex gap-1 mb-2.5">
          <div className="flex-[6] h-2.5 rounded-full bg-gradient-to-r from-[#00b4d8] to-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.15)]" />
          <div className="flex-[4] h-2.5 rounded-full bg-gradient-to-r from-pkmn-yellow-dim to-pkmn-yellow shadow-[0_0_10px_rgba(255,203,5,0.1)]" />
        </div>
        <div className="flex justify-between text-[11px] font-bold">
          <span><span className="text-[#00e5ff]">●</span> 60% Modern (11)</span>
          <span><span className="text-pkmn-yellow">●</span> 40% Vintage (10)</span>
        </div>
      </div>

      <div className="bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="text-[11px] text-txt-dim font-bold uppercase tracking-wider mb-2.5">
          Oracle Status
        </div>
        {[
          { k: "Provider", v: "⚡ Switchboard" },
          { k: "Smoothing", v: "EMT α=0.003" },
          { k: "Cards", v: "21/21 priced" },
          { k: "Status", v: "✅ VALID" },
        ].map((r) => (
          <div key={r.k} className="flex justify-between mb-1 text-xs">
            <span className="text-txt-dim">{r.k}</span>
            <span className="font-bold">{r.v}</span>
          </div>
        ))}
      </div>

      <div className="col-span-2 bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="text-[11px] text-txt-dim font-bold uppercase tracking-wider mb-2.5">
          Sets Included
        </div>
        <div className="flex gap-2 flex-wrap">
          {["Evolving Skies", "Obsidian Flames", "Fusion Strike", "Vivid Voltage", "Lost Origin"].map((s) => (
            <div key={s} className="px-3 py-1 rounded-full bg-[#00b4d8]/10 border border-[#00b4d8]/20 text-[10px] font-extrabold text-[#00e5ff]">
              {s}
            </div>
          ))}
          {["Base Set", "Neo Genesis", "Fossil", "Team Rocket", "Neo Discovery"].map((s) => (
            <div key={s} className="px-3 py-1 rounded-full bg-pkmn-yellow/5 border border-pkmn-yellow/20 text-[10px] font-extrabold text-pkmn-yellow">
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ORACLE VIEW TAB
// ============================================================================
function OracleView({ price }: { price: number }) {
  const slot = 284729000 + Math.floor(Math.random() * 999);
  return (
    <div className="bg-surface-elevated rounded-xl p-5 border border-border font-mono text-xs leading-8">
      <div className="text-txt-dim">
        $ switchboard pull-feed{" "}
        <span className="text-pkmn-red font-bold">PKMN-INDEX</span>{" "}
        <span className="text-txt-dim">v3.0</span>
      </div>
      <div>
        {"  "}price:{"      "}
        <span className="text-pkmn-yellow font-bold">{price.toFixed(6)}</span>
      </div>
      <div>{"  "}confidence: ±0.420000</div>
      <div>{"  "}slot:{"       "}{slot}</div>
      <div>{"  "}cards:{"      "}21 (11 modern + 10 vintage)</div>
      <div>
        {"  "}modern:{"     "}
        <span className="text-[#00e5ff]">60%</span>{" "}
        (SWSH alt arts)
      </div>
      <div>
        {"  "}vintage:{"    "}
        <span className="text-pkmn-yellow">40%</span>{" "}
        (WOTC holos)
      </div>
      <div>{"  "}smoothing:{"  "}EMT α=0.003 | max 0.1%/tick</div>
      <div>{"  "}sources:{"    "}20 TCGPlayer + 1 Cardmarket</div>
      <div>
        {"  "}status:{"     "}
        <span className="text-bull font-bold">VALID ✓</span>
      </div>
      <div className="text-txt-dim">
        {"  "}updated:{"    "}{new Date().toISOString()}
      </div>
    </div>
  );
}
