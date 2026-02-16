"use client";
import { useOraclePrice } from "@/hooks/useOraclePrice";
export function OracleStatus() {
  const { oraclePrice, loading, error } = useOraclePrice();
  if (loading) return (<div className="flex items-center gap-2 text-sm text-gray-400"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />Loading oracle...</div>);
  if (error || oraclePrice.source === "none") return (<div className="flex items-center gap-2 text-sm text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />Oracle offline</div>);
  const age = Date.now() - oraclePrice.timestamp;
  const ageStr = age < 10000 ? "just now" : Math.floor(age / 1000) + "s ago";
  return (
    <div className="flex items-center gap-3">
      <span className={"w-2 h-2 rounded-full " + (oraclePrice.stale ? "bg-yellow-500" : "bg-green-500")} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm text-gray-400 font-medium">PKMN Index</span>
        <span className="text-lg font-bold text-white tabular-nums">{oraclePrice.price.toFixed(2)}</span>
      </div>
      <div className="text-xs text-gray-500"><span className="uppercase">{oraclePrice.source}</span><span className="mx-1">·</span><span>{ageStr}</span></div>
    </div>
  );
}
