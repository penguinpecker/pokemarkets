// ============================================================================
// PRICE & CANDLE TYPES
// ============================================================================
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceTick {
  price: number;
  confidence: number;
  timestamp: number;
  slot: number;
}

// ============================================================================
// INDEX CARD TYPES — v3.0 (21 cards, 60/40 Modern/Vintage)
// ============================================================================
export interface IndexCard {
  name: string;
  set: string;
  tcgdexId: string;
  price: number;
  change: number;
  weight: number;
  tier: "modern" | "vintage";
  source: "tcgplayer" | "cardmarket";
  calPrice: number;
}

export interface IndexData {
  value: number;
  modernComponent: number;
  vintageComponent: number;
  confidence: number;
  timestamp: number;
}

// ============================================================================
// TRADING TYPES
// ============================================================================
export type Side = "long" | "short";
export type OrderType = "market" | "limit" | "stop";

export interface Position {
  id: string;
  side: Side;
  notional: number;         // position size in USD
  sizeIndex: number;        // position size in index units (notional / entryPrice)
  leverage: number;
  entryPrice: number;
  markPrice: number;
  collateral: number;       // initial margin locked
  maintenanceMargin: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedFunding: number;  // accumulated funding payments
  openFee: number;          // fee paid on open
  timestamp: number;
}

export interface TradeRecord {
  id: string;
  side: Side;
  notional: number;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  fees: number;             // open + close fees
  funding: number;          // net funding paid/received
  netPnl: number;
  openedAt: number;
  closedAt: number;
}

export interface FundingTick {
  timestamp: number;
  rate: number;
  payment: number;          // positive = paid, negative = received
  positionId: string;
}

export interface OrderParams {
  side: Side;
  type: OrderType;
  amount: number;
  leverage: number;
  limitPrice?: number;
  stopPrice?: number;
}

export interface MarketStats {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  openInterest: number;
  fundingRate: number;
  volume24h: number;
  nextFunding: number;
}

export interface OracleStatus {
  provider: string;
  lastUpdate: number;
  confidence: number;
  status: "valid" | "stale" | "invalid";
  modernIndex: number;
  vintageIndex: number;
  slot: number;
}
