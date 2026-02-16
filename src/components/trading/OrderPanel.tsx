"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CardDeck } from "@/components/ui/CardDeck";
import { useTradeStore } from "@/hooks/useTradeStore";
import { useOraclePrice } from "@/hooks/useOraclePrice";
import { MARKET_CONFIG } from "@/lib/constants";
import type { OrderType } from "@/lib/types";

const QUICK_AMOUNTS = [25, 50, 100, 250, 500];
const SOL_DEPOSIT_PRESETS = [0.5, 1, 2, 5];
const USDC_DEPOSIT_PRESETS = [50, 100, 500, 1000];
const ORDER_TYPES = ["Market", "Limit", "Stop"] as const;
const LEV_MARKS = [1, 2, 3, 4, 5];

const REJECT_MESSAGES: Record<string, string> = {
  INSUFFICIENT_MARGIN: "Insufficient margin",
  MAX_POSITIONS: "Max 10 positions reached",
  MIN_ORDER_SIZE: `Min order $${MARKET_CONFIG.minOrderSize}`,
  MAX_LEVERAGE: `Max leverage ${MARKET_CONFIG.maxLeverage}x`,
  NO_DEPOSIT: "Deposit collateral first",
  ZERO_PRICE: "Waiting for oracle price",
};

export function OrderPanel() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { oraclePrice } = useOraclePrice();

  const {
    side, setSide,
    orderType, setOrderType,
    amount, setAmount,
    leverage, setLeverage,
    livePrice,
    deposited,
    metrics,
    positions,
    openPosition,
    deposit,
    withdraw,
    fundingRate,
    nextFundingTime,
  } = useTradeStore();

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositInput, setDepositInput] = useState("1");
  const [depositAsset, setDepositAsset] = useState<"SOL" | "USDC">("SOL");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [txFlash, setTxFlash] = useState<string | null>(null);
  const [rejectFlash, setRejectFlash] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState(0);

  // Fetch SOL price for conversion
  useEffect(() => {
    let active = true;
    const fetchSol = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
          { cache: "no-store" }
        );
        const data = await res.json();
        if (active && data?.solana?.usd) {
          setSolPrice(data.solana.usd);
        }
      } catch {
        // Fallback — use a reasonable default so UI isn't broken
        if (active && solPrice === 0) setSolPrice(150);
      }
    };
    fetchSol();
    const iv = setInterval(fetchSol, 60000); // refresh every 60s
    return () => { active = false; clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const amt = parseFloat(amount) || 0;
  const notional = amt * leverage;
  const fee = notional * MARKET_CONFIG.tradingFee;
  const requiredMargin = notional * MARKET_CONFIG.initialMargin;

  const liqDistance = amt > 0 ? (amt - notional * MARKET_CONFIG.maintenanceMargin) / notional : 0;
  const liqPrice = side === "long"
    ? livePrice * (1 - liqDistance)
    : livePrice * (1 + liqDistance);

  // Funding countdown
  const fundingCountdown = useMemo(() => {
    const remaining = Math.max(0, nextFundingTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [nextFundingTime]);

  // Max position size with current free margin
  const maxCollateral = metrics.freeMargin;

  // Deposit USD value preview
  const depositInputNum = parseFloat(depositInput) || 0;
  const depositUsdValue = depositAsset === "SOL"
    ? depositInputNum * solPrice
    : depositInputNum;

  // Pre-validate for button state
  const preValidation = useMemo(() => {
    if (!connected) return "CONNECT";
    if (deposited <= 0) return "NO_DEPOSIT";
    if (amt < MARKET_CONFIG.minOrderSize) return "MIN_SIZE";
    if (amt > metrics.freeMargin) return "NO_MARGIN";
    if (leverage > MARKET_CONFIG.maxLeverage) return "MAX_LEV";
    if (positions.length >= 10) return "MAX_POS";
    return "OK";
  }, [connected, deposited, amt, metrics.freeMargin, leverage, positions.length]);

  const handleTrade = useCallback(() => {
    if (!connected) {
      setVisible(true);
      return;
    }

    const reject = openPosition();
    if (reject) {
      setRejectFlash(REJECT_MESSAGES[reject] || reject);
      setTimeout(() => setRejectFlash(null), 3000);
      return;
    }

    setTxFlash(`${side.toUpperCase()} $${notional.toFixed(0)} PKMN-PERP @ ${livePrice.toFixed(2)}`);
    setTimeout(() => setTxFlash(null), 3000);
  }, [connected, openPosition, side, notional, livePrice, setVisible]);

  const handleDeposit = useCallback(() => {
    if (depositInputNum <= 0) return;
    if (depositAsset === "SOL" && solPrice <= 0) return;

    const usdValue = depositAsset === "SOL"
      ? depositInputNum * solPrice
      : depositInputNum;

    deposit(usdValue);
    setShowDeposit(false);

    const label = depositAsset === "SOL"
      ? `${depositInputNum} SOL ($${usdValue.toFixed(2)})`
      : `$${usdValue.toFixed(2)} USDC`;
    setTxFlash(`Deposited ${label}`);
    setTimeout(() => setTxFlash(null), 3000);
  }, [depositInputNum, depositAsset, solPrice, deposit]);

  const handleWithdraw = useCallback(() => {
    const wAmt = parseFloat(withdrawInput);
    if (!wAmt || wAmt <= 0) return;
    const ok = withdraw(wAmt);
    if (!ok) {
      setRejectFlash("Exceeds free margin");
      setTimeout(() => setRejectFlash(null), 3000);
      return;
    }
    setShowWithdraw(false);
    setTxFlash(`Withdrew $${wAmt.toFixed(2)}`);
    setTimeout(() => setTxFlash(null), 3000);
  }, [withdrawInput, withdraw]);

  // Oracle age
  const oracleAge = Date.now() - oraclePrice.timestamp;
  const oracleAgeStr = oracleAge < 10000 ? "just now" : Math.floor(oracleAge / 1000) + "s ago";

  return (
    <div className="bg-surface-card rounded-2xl border border-border shadow-card p-5 flex flex-col gap-4 h-fit sticky top-3">
      {/* Header */}
      <div className="flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
        <CardDeck size={20} />
        <span className="font-black text-[13px] text-pkmn-yellow tracking-[0.15em] drop-shadow-[0_0_10px_rgba(255,203,5,0.2)]">
          TRADE
        </span>
        <CardDeck size={20} />
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
      </div>

      {/* ── Account Panel ────────────────────────────────── */}
      {connected ? (
        <div className="bg-surface-elevated rounded-lg border border-border px-3 py-2 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-txt-dim font-bold">Equity</span>
            <span className="text-pkmn-yellow font-extrabold">
              ${metrics.equity.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-txt-dim font-bold">Free Margin</span>
            <span className={`font-extrabold ${metrics.freeMargin < 50 && deposited > 0 ? "text-bear" : "text-txt-primary"}`}>
              ${metrics.freeMargin.toFixed(2)}
            </span>
          </div>
          {positions.length > 0 && (
            <>
              <div className="flex justify-between text-[11px]">
                <span className="text-txt-dim font-bold">Used Margin</span>
                <span className="text-txt-primary font-extrabold">
                  ${metrics.totalInitialMargin.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-txt-dim font-bold">Acct Leverage</span>
                <span className="text-txt-primary font-extrabold">
                  {metrics.accountLeverage.toFixed(2)}x
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-txt-dim font-bold">Unrealized PnL</span>
                <span className={`font-extrabold ${metrics.totalUnrealizedPnl >= 0 ? "text-bull" : "text-bear"}`}>
                  {metrics.totalUnrealizedPnl >= 0 ? "+" : ""}${metrics.totalUnrealizedPnl.toFixed(2)}
                </span>
              </div>
              {/* Margin health bar */}
              <div className="mt-1">
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span className="text-txt-dim font-bold">Margin Health</span>
                  <span className={`font-extrabold ${
                    metrics.marginRatio > 0.8 ? "text-bear" : metrics.marginRatio > 0.5 ? "text-pkmn-yellow" : "text-bull"
                  }`}>
                    {((1 - metrics.marginRatio) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-input rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      metrics.marginRatio > 0.8 ? "bg-bear" : metrics.marginRatio > 0.5 ? "bg-pkmn-yellow" : "bg-bull"
                    }`}
                    style={{ width: `${Math.max(2, Math.min(100, (1 - metrics.marginRatio) * 100))}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Deposit / Withdraw buttons */}
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={() => { setShowDeposit(!showDeposit); setShowWithdraw(false); }}
              className="flex-1 text-[10px] font-extrabold text-pkmn-yellow bg-pkmn-yellow-glow px-2.5 py-1.5 rounded-lg border border-pkmn-yellow/20 hover:bg-pkmn-yellow/10 transition-colors"
            >
              {showDeposit ? "Cancel" : "💰 Deposit"}
            </button>
            {deposited > 0 && (
              <button
                onClick={() => { setShowWithdraw(!showWithdraw); setShowDeposit(false); }}
                className="flex-1 text-[10px] font-extrabold text-txt-dim bg-surface-input px-2.5 py-1.5 rounded-lg border border-border hover:border-border-light transition-colors"
              >
                {showWithdraw ? "Cancel" : "Withdraw"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setVisible(true)}
          className="w-full py-3 rounded-xl text-[12px] font-extrabold text-pkmn-yellow border-2 border-pkmn-yellow/20 bg-pkmn-yellow-glow hover:bg-pkmn-yellow/10 transition-colors"
        >
          Connect Wallet to Trade
        </button>
      )}

      {/* ── Deposit Panel ────────────────────────────────── */}
      {showDeposit && connected && (
        <div className="bg-surface-elevated rounded-xl p-3.5 border border-pkmn-yellow/20 animate-slide-up">
          {/* Asset toggle */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-txt-dim font-bold uppercase tracking-wider">
              Deposit Collateral
            </div>
            <div className="flex bg-surface-input rounded-lg border border-border overflow-hidden">
              {(["SOL", "USDC"] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => {
                    setDepositAsset(asset);
                    setDepositInput(asset === "SOL" ? "1" : "100");
                  }}
                  className={`px-3 py-1 text-[10px] font-extrabold transition-all ${
                    depositAsset === asset
                      ? "bg-pkmn-yellow/20 text-pkmn-yellow"
                      : "text-txt-dim hover:text-txt-mid"
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          {/* Input + button */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-surface-input rounded-lg border border-border overflow-hidden">
              <span className="px-2 text-txt-dim text-sm font-bold">
                {depositAsset === "SOL" ? "◎" : "$"}
              </span>
              <input
                type="number"
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                className="flex-1 bg-transparent border-none text-pkmn-yellow py-2 pr-2 text-sm font-black outline-none font-body [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
              <span className="pr-2 text-txt-dim text-xs font-bold">{depositAsset}</span>
            </div>
            <button
              onClick={handleDeposit}
              disabled={depositInputNum <= 0 || (depositAsset === "SOL" && solPrice <= 0)}
              className="bg-bull text-white px-4 py-2 rounded-lg text-xs font-extrabold hover:shadow-glow-green transition-all disabled:opacity-50"
            >
              Deposit
            </button>
          </div>

          {/* Presets */}
          <div className="flex gap-1 mt-1.5">
            {(depositAsset === "SOL" ? SOL_DEPOSIT_PRESETS : USDC_DEPOSIT_PRESETS).map((v) => (
              <button
                key={v}
                onClick={() => setDepositInput(String(v))}
                className="flex-1 bg-surface-input border border-border text-txt-mid py-1 rounded text-[10px] font-bold hover:border-border-light transition-colors"
              >
                {depositAsset === "SOL" ? `${v} ◎` : `$${v}`}
              </button>
            ))}
          </div>

          {/* USD equivalent + SOL price */}
          <div className="mt-1.5 space-y-0.5">
            {depositAsset === "SOL" && solPrice > 0 && depositInputNum > 0 && (
              <div className="text-[10px] text-pkmn-yellow font-bold text-center">
                ≈ ${depositUsdValue.toFixed(2)} USD @ ${solPrice.toFixed(2)}/SOL
              </div>
            )}
            <div className="text-[9px] text-txt-dim font-semibold text-center">
              {depositAsset === "SOL"
                ? "Deposit devnet SOL as collateral (faucet.solana.com)"
                : "Deposit USDC as collateral"}
            </div>
          </div>
        </div>
      )}

      {/* ── Withdraw Panel ───────────────────────────────── */}
      {showWithdraw && connected && (
        <div className="bg-surface-elevated rounded-xl p-3.5 border border-border animate-slide-up">
          <div className="text-[10px] text-txt-dim font-bold uppercase tracking-wider mb-2">
            Withdraw (Max: ${metrics.freeMargin.toFixed(2)})
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-surface-input rounded-lg border border-border overflow-hidden">
              <span className="px-2 text-txt-dim text-sm font-bold">$</span>
              <input
                type="number"
                value={withdrawInput}
                onChange={(e) => setWithdrawInput(e.target.value)}
                className="flex-1 bg-transparent border-none text-txt-primary py-2 pr-2 text-sm font-black outline-none font-body [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>
            <button
              onClick={handleWithdraw}
              className="bg-surface-card text-txt-primary px-4 py-2 rounded-lg text-xs font-extrabold border border-border hover:border-border-light transition-all"
            >
              Withdraw
            </button>
          </div>
          <button
            onClick={() => setWithdrawInput(metrics.freeMargin.toFixed(2))}
            className="mt-1 text-[9px] text-pkmn-yellow font-bold hover:underline"
          >
            Max withdraw
          </button>
        </div>
      )}

      {/* ── Trade Form (only when deposited) ─────────────── */}
      {connected && deposited > 0 && (
        <>
          {/* Side toggle */}
          <div className="grid grid-cols-2 gap-1.5 bg-surface-elevated rounded-xl p-1 border border-border">
            {(["long", "short"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`py-3 rounded-lg font-black text-sm uppercase tracking-[0.15em] font-body transition-all ${
                  side === s
                    ? s === "long"
                      ? "bg-bull text-white shadow-glow-green"
                      : "bg-bear text-white shadow-glow-red"
                    : "text-txt-dim hover:text-txt-mid"
                }`}
              >
                {s === "long" ? "⬆ Long" : "⬇ Short"}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div className="flex gap-1">
            {ORDER_TYPES.map((ot) => (
              <button
                key={ot}
                onClick={() => setOrderType(ot.toLowerCase() as OrderType)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold font-body transition-colors ${
                  orderType === ot.toLowerCase()
                    ? "bg-surface-elevated border border-border-light text-txt-primary"
                    : "border border-transparent text-txt-dim"
                }`}
              >
                {ot}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] text-txt-dim font-bold uppercase tracking-wider">
                Collateral (USD)
              </label>
              <span className="text-[9px] text-txt-dim font-bold">
                Max: ${maxCollateral.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center bg-surface-input rounded-lg border-2 border-border focus-within:border-pkmn-yellow/30 transition-colors overflow-hidden">
              <span className="px-3 text-txt-dim text-base font-bold">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent border-none text-pkmn-yellow py-3 pr-3 text-xl font-black outline-none font-body [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-1 mt-1.5">
              {QUICK_AMOUNTS.filter((v) => v <= maxCollateral + 1).map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(Math.min(v, maxCollateral)))}
                  className="flex-1 bg-surface-elevated border border-border text-txt-mid py-1 rounded-lg text-[11px] font-bold font-body hover:border-border-light hover:text-txt-primary transition-colors"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] text-txt-dim font-bold uppercase tracking-wider">
                Leverage
              </span>
              <span className="text-base font-black text-pkmn-yellow bg-surface-elevated px-3 py-0.5 rounded-lg border border-border drop-shadow-[0_0_8px_rgba(255,203,5,0.2)]">
                {leverage}x
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={MARKET_CONFIG.maxLeverage}
              step={0.5}
              value={leverage}
              onChange={(e) => setLeverage(parseFloat(e.target.value))}
              className="w-full accent-pkmn-yellow"
            />
            <div className="flex justify-between text-[10px] text-txt-dim font-bold mt-0.5">
              {LEV_MARKS.map((v) => (
                <span key={v}>{v}x</span>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-surface-elevated rounded-xl p-3.5 border border-border">
            {[
              { k: "Market", v: "PKMN-PERP" },
              { k: "Entry Price", v: `$${livePrice.toFixed(2)}` },
              { k: "Position Size", v: `$${notional.toFixed(2)}` },
              { k: "Collateral", v: `$${amt.toFixed(2)}` },
              { k: "Init. Margin Req", v: `$${requiredMargin.toFixed(2)}`, warn: amt > 0 && amt < requiredMargin },
              { k: "Liq. Price", v: amt > 0 ? `$${liqPrice.toFixed(2)}` : "—" },
              { k: "Fee (0.08%)", v: `$${fee.toFixed(2)}` },
            ].map((r) => (
              <div key={r.k} className="flex justify-between mb-1 text-xs">
                <span className="text-txt-dim font-semibold">{r.k}</span>
                <span className={`font-extrabold ${r.warn ? "text-bear" : ""}`}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleTrade}
            disabled={preValidation !== "OK"}
            className={`w-full py-4 rounded-xl font-black text-[15px] tracking-wider uppercase font-body transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              side === "long"
                ? "bg-gradient-to-r from-[#16A34A] to-bull text-white shadow-glow-green hover:shadow-[0_0_30px_rgba(34,197,94,0.35)]"
                : "bg-gradient-to-r from-[#CC0000] to-bear text-white shadow-glow-red hover:shadow-[0_0_30px_rgba(232,0,13,0.35)]"
            }`}
          >
            {preValidation === "NO_MARGIN"
              ? "Insufficient Margin"
              : preValidation === "NO_DEPOSIT"
                ? "Deposit First"
                : preValidation === "MAX_POS"
                  ? "Max Positions Reached"
                  : `${side === "long" ? "⬆ Long" : "⬇ Short"} PKMN-PERP`}
          </button>
        </>
      )}

      {/* ── First-time deposit prompt ────────────────────── */}
      {connected && deposited <= 0 && !showDeposit && (
        <div className="text-center py-3 space-y-2">
          <div className="text-txt-mid font-bold text-[13px]">No collateral deposited</div>
          <div className="text-txt-dim text-[11px]">
            Deposit SOL or USDC to start paper trading PKMN-PERP
          </div>
          <button
            onClick={() => setShowDeposit(true)}
            className="mt-1 px-6 py-2 bg-pkmn-yellow/10 border border-pkmn-yellow/20 text-pkmn-yellow rounded-lg text-[12px] font-extrabold hover:bg-pkmn-yellow/15 transition-colors"
          >
            💰 Deposit Collateral
          </button>
        </div>
      )}

      {/* ── Flash messages ───────────────────────────────── */}
      {txFlash && (
        <div className="text-[10px] font-bold px-3 py-2 rounded-lg animate-slide-up bg-bull/10 text-bull border border-bull/20">
          ✅ {txFlash}
        </div>
      )}
      {rejectFlash && (
        <div className="text-[10px] font-bold px-3 py-2 rounded-lg animate-slide-up bg-bear/10 text-bear border border-bear/20">
          ❌ {rejectFlash}
        </div>
      )}

      {/* ── Oracle + Funding ─────────────────────────────── */}
      <div className="bg-surface-elevated rounded-xl p-3 border border-border">
        <div className="text-[9px] text-pkmn-yellow font-extrabold uppercase tracking-widest mb-1.5">
          ⚡ PKMN-PERP — PAPER TRADING
        </div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-txt-dim font-semibold">Oracle Price</span>
          <span className="font-extrabold text-pkmn-yellow">${livePrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-txt-dim font-semibold">Funding Rate</span>
          <span className={`font-extrabold ${fundingRate >= 0 ? "text-bull" : "text-bear"}`}>
            {fundingRate >= 0 ? "+" : ""}{(fundingRate * 100).toFixed(4)}%
          </span>
        </div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-txt-dim font-semibold">Next Funding</span>
          <span className="font-extrabold text-pkmn-yellow">{fundingCountdown}</span>
        </div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-txt-dim font-semibold">Oracle</span>
          <span className="font-extrabold text-txt-primary">
            {oraclePrice.source !== "none" ? `TCGdx · ${oracleAgeStr}` : "—"}
          </span>
        </div>
        {solPrice > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-txt-dim font-semibold">SOL/USD</span>
            <span className="font-extrabold text-txt-primary">${solPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Network badge */}
      <div className="flex justify-between text-[10px] text-txt-dim font-semibold bg-surface-elevated rounded-lg px-3 py-1.5 border border-border">
        <span>📋 Paper Trading</span>
        <span className="text-pkmn-yellow font-extrabold">PKMN-PERP v3.0</span>
      </div>
    </div>
  );
}
