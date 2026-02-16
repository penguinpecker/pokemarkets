import { create } from "zustand";
import type { Side, OrderType, Position, Candle, TradeRecord, FundingTick } from "@/lib/types";
import { generateCandles, MARKET_CONFIG } from "@/lib/constants";

// ============================================================================
// PKMN-PERP MARGIN ENGINE
// Cross-margin model. All collateral shared across positions.
// Liquidation at maintenance margin. Funding every hour.
// ============================================================================

const IMF = MARKET_CONFIG.initialMargin;     // 0.20 → max 5x
const MMF = MARKET_CONFIG.maintenanceMargin; // 0.10 → liquidation threshold
const TAKER_FEE = MARKET_CONFIG.tradingFee;  // 0.08%
const FUNDING_PERIOD = MARKET_CONFIG.fundingPeriodMs;
const MAX_POSITIONS = 10;
const LIQUIDATION_FEE = 0.005;               // 0.5% penalty on liq
const MAX_SLIPPAGE = 0.001;                  // 0.1% simulated slippage

// ============================================================================
// TYPES
// ============================================================================
interface AccountMetrics {
  equity: number;
  totalInitialMargin: number;
  totalMaintenanceMargin: number;
  freeMargin: number;
  marginRatio: number;       // maintenance margin / equity (>1 = liquidation)
  accountLeverage: number;   // total notional / equity
  totalUnrealizedPnl: number;
  totalNotional: number;
}

type OrderRejectReason =
  | null
  | "INSUFFICIENT_MARGIN"
  | "MAX_POSITIONS"
  | "MIN_ORDER_SIZE"
  | "MAX_LEVERAGE"
  | "NO_DEPOSIT"
  | "ZERO_PRICE";

interface TradeState {
  // Oracle price
  livePrice: number;
  candles: Candle[];
  setLivePrice: (p: number) => void;

  // Account — starts at $0, must deposit first
  deposited: number;
  realizedPnl: number;
  totalFeesPaid: number;
  totalFundingPaid: number;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;

  // Computed account metrics (recalculated on every tick)
  metrics: AccountMetrics;

  // Positions (cross-margin)
  positions: Position[];
  openPosition: () => OrderRejectReason;
  closePosition: (id: string) => void;

  // Funding
  fundingRate: number;
  nextFundingTime: number;
  fundingHistory: FundingTick[];

  // Trade history
  tradeHistory: TradeRecord[];

  // Liquidation log
  liquidationLog: string[];

  // Order form
  side: Side;
  orderType: OrderType;
  amount: string;
  leverage: number;
  limitPrice: string;
  setSide: (s: Side) => void;
  setOrderType: (t: OrderType) => void;
  setAmount: (a: string) => void;
  setLeverage: (l: number) => void;
  setLimitPrice: (p: string) => void;

  // Engine tick — call every 2s
  tick: () => void;

  // UI
  chartTab: "chart" | "info" | "oracle";
  indexTab: "modern" | "vintage";
  timeframe: string;
  setChartTab: (t: "chart" | "info" | "oracle") => void;
  setIndexTab: (t: "modern" | "vintage") => void;
  setTimeframe: (tf: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================
function calcMetrics(
  deposited: number,
  realizedPnl: number,
  totalFeesPaid: number,
  totalFundingPaid: number,
  positions: Position[]
): AccountMetrics {
  const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalFunding = positions.reduce((s, p) => s + p.realizedFunding, 0);
  const equity = deposited + realizedPnl - totalFeesPaid - totalFundingPaid + totalUnrealizedPnl - totalFunding;
  const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
  const totalInitialMargin = positions.reduce((s, p) => s + p.notional * IMF, 0);
  const totalMaintenanceMargin = positions.reduce((s, p) => s + p.maintenanceMargin, 0);
  const freeMargin = Math.max(0, equity - totalInitialMargin);
  const marginRatio = equity > 0 ? totalMaintenanceMargin / equity : 0;
  const accountLeverage = equity > 0 ? totalNotional / equity : 0;

  return {
    equity: Math.max(0, equity),
    totalInitialMargin,
    totalMaintenanceMargin,
    freeMargin,
    marginRatio,
    accountLeverage,
    totalUnrealizedPnl,
    totalNotional,
  };
}

function calcLiqPrice(side: Side, entryPrice: number, collateral: number, notional: number): number {
  // Price at which (collateral + PnL) = maintenance margin
  const mm = notional * MMF;
  const buffer = collateral - mm;
  if (side === "long") {
    return entryPrice * (1 - buffer / notional);
  } else {
    return entryPrice * (1 + buffer / notional);
  }
}

function applySlippage(price: number, side: Side): number {
  const slip = price * MAX_SLIPPAGE * Math.random();
  return side === "long" ? price + slip : price - slip;
}

// ============================================================================
// STORE
// ============================================================================
export const useTradeStore = create<TradeState>((set, get) => ({
  // Oracle price
  livePrice: 100.0,
  candles: generateCandles("4H"),
  setLivePrice: (price) => set({ livePrice: price }),

  // Account — $0 start. Must deposit.
  deposited: 0,
  realizedPnl: 0,
  totalFeesPaid: 0,
  totalFundingPaid: 0,

  deposit: (amount) => {
    if (amount <= 0) return;
    set((s) => {
      const newDeposited = s.deposited + amount;
      return {
        deposited: newDeposited,
        metrics: calcMetrics(newDeposited, s.realizedPnl, s.totalFeesPaid, s.totalFundingPaid, s.positions),
      };
    });
  },

  withdraw: (amount) => {
    const state = get();
    if (amount <= 0 || amount > state.metrics.freeMargin) return false;
    set((s) => {
      const newDeposited = s.deposited - amount;
      return {
        deposited: newDeposited,
        metrics: calcMetrics(newDeposited, s.realizedPnl, s.totalFeesPaid, s.totalFundingPaid, s.positions),
      };
    });
    return true;
  },

  // Metrics
  metrics: {
    equity: 0,
    totalInitialMargin: 0,
    totalMaintenanceMargin: 0,
    freeMargin: 0,
    marginRatio: 0,
    accountLeverage: 0,
    totalUnrealizedPnl: 0,
    totalNotional: 0,
  },

  // Positions
  positions: [],

  openPosition: () => {
    const state = get();
    const amt = parseFloat(state.amount) || 0;
    const price = state.livePrice;

    // ── Validation ──────────────────────────────────────────
    if (price <= 0) return "ZERO_PRICE";
    if (state.deposited <= 0) return "NO_DEPOSIT";
    if (amt < MARKET_CONFIG.minOrderSize) return "MIN_ORDER_SIZE";
    if (state.leverage > MARKET_CONFIG.maxLeverage) return "MAX_LEVERAGE";
    if (state.positions.length >= MAX_POSITIONS) return "MAX_POSITIONS";

    const notional = amt * state.leverage;
    const requiredMargin = notional * IMF;

    // Check if collateral (amt) covers initial margin
    if (amt < requiredMargin) return "INSUFFICIENT_MARGIN";

    // Check free margin in account
    if (amt > state.metrics.freeMargin) return "INSUFFICIENT_MARGIN";

    // ── Execute ─────────────────────────────────────────────
    const fillPrice = applySlippage(price, state.side);
    const openFee = notional * TAKER_FEE;
    const sizeIndex = notional / fillPrice;
    const mm = notional * MMF;
    const liqPrice = calcLiqPrice(state.side, fillPrice, amt, notional);

    const position: Position = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      side: state.side,
      notional,
      sizeIndex,
      leverage: state.leverage,
      entryPrice: fillPrice,
      markPrice: fillPrice,
      collateral: amt,
      maintenanceMargin: mm,
      liquidationPrice: Math.max(0, liqPrice),
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      realizedFunding: 0,
      openFee,
      timestamp: Date.now(),
    };

    set((s) => {
      const newPositions = [...s.positions, position];
      const newFees = s.totalFeesPaid + openFee;
      return {
        positions: newPositions,
        totalFeesPaid: newFees,
        metrics: calcMetrics(s.deposited, s.realizedPnl, newFees, s.totalFundingPaid, newPositions),
      };
    });

    return null; // success
  },

  closePosition: (id) => {
    const state = get();
    const pos = state.positions.find((p) => p.id === id);
    if (!pos) return;

    const fillPrice = applySlippage(state.livePrice, pos.side === "long" ? "short" : "long");
    const closeFee = pos.notional * TAKER_FEE;

    // PnL calculation
    const priceDiff = fillPrice - pos.entryPrice;
    const direction = pos.side === "long" ? 1 : -1;
    const grossPnl = direction * priceDiff * pos.sizeIndex;
    const netPnl = grossPnl - pos.openFee - closeFee - pos.realizedFunding;

    const record: TradeRecord = {
      id: pos.id,
      side: pos.side,
      notional: pos.notional,
      leverage: pos.leverage,
      entryPrice: pos.entryPrice,
      exitPrice: fillPrice,
      grossPnl,
      fees: pos.openFee + closeFee,
      funding: pos.realizedFunding,
      netPnl,
      openedAt: pos.timestamp,
      closedAt: Date.now(),
    };

    set((s) => {
      const newPositions = s.positions.filter((p) => p.id !== id);
      const newRealizedPnl = s.realizedPnl + grossPnl;
      const newFees = s.totalFeesPaid + closeFee;
      const newFunding = s.totalFundingPaid; // funding already tracked per-position
      return {
        positions: newPositions,
        realizedPnl: newRealizedPnl,
        totalFeesPaid: newFees,
        tradeHistory: [record, ...s.tradeHistory].slice(0, 100),
        metrics: calcMetrics(s.deposited, newRealizedPnl, newFees, newFunding, newPositions),
      };
    });
  },

  // Funding
  fundingRate: 0.0001, // 0.01% per period (start)
  nextFundingTime: Date.now() + FUNDING_PERIOD,
  fundingHistory: [],

  // Trade history
  tradeHistory: [],

  // Liquidation log
  liquidationLog: [],

  // Order form
  side: "long",
  orderType: "market",
  amount: "100",
  leverage: 3,
  limitPrice: "",
  setSide: (side) => set({ side }),
  setOrderType: (orderType) => set({ orderType }),
  setAmount: (amount) => set({ amount }),
  setLeverage: (leverage) => set({ leverage }),
  setLimitPrice: (limitPrice) => set({ limitPrice }),

  // ══════════════════════════════════════════════════════════
  // ENGINE TICK — runs every 2 seconds
  // 1. Micro-jitter the live price
  // 2. Sync mark prices + unrealized PnL
  // 3. Check funding
  // 4. Check liquidations
  // ══════════════════════════════════════════════════════════
  tick: () => {
    const now = Date.now();

    set((state) => {
      if (state.positions.length === 0) {
        // Still jitter price
        const newPrice = state.livePrice + (Math.random() - 0.48) * 0.06;
        return { livePrice: newPrice };
      }

      const newPrice = state.livePrice + (Math.random() - 0.48) * 0.06;
      let newFundingHistory = [...state.fundingHistory];
      let newFundingRate = state.fundingRate;
      let newNextFunding = state.nextFundingTime;
      let newTotalFunding = state.totalFundingPaid;

      // ── 1. Apply funding if period elapsed ──────────────
      let applyFunding = false;
      if (now >= state.nextFundingTime) {
        applyFunding = true;
        // Random walk funding rate: drift slightly, bounded [-0.05%, +0.05%]
        const drift = (Math.random() - 0.5) * 0.00005;
        newFundingRate = Math.max(-0.0005, Math.min(0.0005, state.fundingRate + drift));
        newNextFunding = now + FUNDING_PERIOD;
      }

      // ── 2. Update positions ────────────────────────────
      const updated: Position[] = [];
      const liquidated: string[] = [];

      for (const pos of state.positions) {
        const p = { ...pos, markPrice: newPrice };

        // Unrealized PnL
        const priceDiff = newPrice - p.entryPrice;
        const direction = p.side === "long" ? 1 : -1;
        p.unrealizedPnl = direction * priceDiff * p.sizeIndex;
        p.unrealizedPnlPercent = p.collateral > 0 ? (p.unrealizedPnl / p.collateral) * 100 : 0;

        // Apply funding
        if (applyFunding) {
          // Longs pay when rate > 0, shorts pay when rate < 0
          const fundingDir = p.side === "long" ? 1 : -1;
          const payment = p.notional * newFundingRate * fundingDir;
          p.realizedFunding += payment;
          newTotalFunding += payment;

          newFundingHistory.push({
            timestamp: now,
            rate: newFundingRate,
            payment,
            positionId: p.id,
          });
        }

        // ── 3. Liquidation check ───────────────────────
        // Position equity = collateral + unrealizedPnl - funding
        const posEquity = p.collateral + p.unrealizedPnl - p.realizedFunding;
        if (posEquity <= p.maintenanceMargin) {
          // LIQUIDATE — close at mark with penalty
          const liqPenalty = p.notional * LIQUIDATION_FEE;
          const pnl = p.unrealizedPnl - p.openFee - liqPenalty - p.realizedFunding;

          const record: TradeRecord = {
            id: p.id,
            side: p.side,
            notional: p.notional,
            leverage: p.leverage,
            entryPrice: p.entryPrice,
            exitPrice: newPrice,
            grossPnl: p.unrealizedPnl,
            fees: p.openFee + liqPenalty,
            funding: p.realizedFunding,
            netPnl: pnl,
            openedAt: p.timestamp,
            closedAt: now,
          };

          liquidated.push(
            `⚠ LIQUIDATED ${p.side.toUpperCase()} $${p.notional.toFixed(0)} @ ${newPrice.toFixed(2)} | Loss: $${Math.abs(pnl).toFixed(2)}`
          );

          // Don't push to updated (position removed)
          // But we need to update realized PnL — handled below
          state.tradeHistory.unshift(record);
          state.realizedPnl += p.unrealizedPnl;
          state.totalFeesPaid += liqPenalty;
          continue;
        }

        updated.push(p);
      }

      // Trim histories
      newFundingHistory = newFundingHistory.slice(-200);

      const newMetrics = calcMetrics(
        state.deposited,
        state.realizedPnl,
        state.totalFeesPaid,
        newTotalFunding,
        updated
      );

      return {
        livePrice: newPrice,
        positions: updated,
        metrics: newMetrics,
        fundingRate: newFundingRate,
        nextFundingTime: newNextFunding,
        fundingHistory: newFundingHistory,
        totalFundingPaid: newTotalFunding,
        tradeHistory: state.tradeHistory.slice(0, 100),
        liquidationLog: [...liquidated, ...state.liquidationLog].slice(0, 20),
      };
    });
  },

  // UI
  chartTab: "chart",
  indexTab: "modern",
  timeframe: "4H",
  setChartTab: (chartTab) => set({ chartTab }),
  setIndexTab: (indexTab) => set({ indexTab }),
  setTimeframe: (timeframe) => set({ timeframe, candles: generateCandles(timeframe) }),
}));
