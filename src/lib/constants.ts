import type { IndexCard, Candle, MarketStats } from "./types";

// ============================================================================
// PKMN-INDEX v3.0 — 21 cards | 60% Modern / 40% Vintage
// Calibration basket: $418.41 = Index 100.00
// ============================================================================

export const MODERN_CARDS: IndexCard[] = [
  { name: "Charizard ex", set: "Obsidian Flames", tcgdexId: "sv03-125", weight: 0.08, tier: "modern", calPrice: 80.00, price: 80.00, change: 1.2, source: "tcgplayer" },
  { name: "Umbreon VMAX Alt Art", set: "Evolving Skies", tcgdexId: "swsh7-215", weight: 0.07, tier: "modern", calPrice: 1730.00, price: 1730.00, change: -0.8, source: "tcgplayer" },
  { name: "Giratina VSTAR Alt Art", set: "Lost Origin", tcgdexId: "swsh11-131", weight: 0.06, tier: "modern", calPrice: 160.00, price: 160.00, change: 2.1, source: "tcgplayer" },
  { name: "Rayquaza VMAX Alt Art", set: "Evolving Skies", tcgdexId: "swsh7-218", weight: 0.06, tier: "modern", calPrice: 659.00, price: 659.00, change: 0.4, source: "tcgplayer" },
  { name: "Pikachu VMAX Rainbow", set: "Vivid Voltage", tcgdexId: "swsh4-188", weight: 0.05, tier: "modern", calPrice: 143.85, price: 143.85, change: -0.3, source: "tcgplayer" },
  { name: "Umbreon V Alt Art", set: "Evolving Skies", tcgdexId: "swsh7-189", weight: 0.05, tier: "modern", calPrice: 299.02, price: 299.02, change: 1.5, source: "tcgplayer" },
  { name: "Glaceon VMAX Alt Art", set: "Evolving Skies", tcgdexId: "swsh7-209", weight: 0.05, tier: "modern", calPrice: 261.48, price: 261.48, change: 0.7, source: "tcgplayer" },
  { name: "Mew VMAX Alt Art", set: "Fusion Strike", tcgdexId: "swsh8-269", weight: 0.05, tier: "modern", calPrice: 181.00, price: 181.00, change: -0.5, source: "tcgplayer" },
  { name: "Charizard ex SAR", set: "Obsidian Flames", tcgdexId: "sv03-223", weight: 0.05, tier: "modern", calPrice: 150.00, price: 150.00, change: 3.1, source: "tcgplayer" },
  { name: "Charizard VSTAR Rainbow", set: "Brilliant Stars", tcgdexId: "swsh9-174", weight: 0.05, tier: "modern", calPrice: 61.92, price: 61.92, change: 0.9, source: "tcgplayer" },
  { name: "Charizard UPC Promo", set: "Crown Zenith", tcgdexId: "swsh12pt5gg-GG70", weight: 0.03, tier: "modern", calPrice: 120.00, price: 120.00, change: -0.2, source: "tcgplayer" },
];

export const VINTAGE_CARDS: IndexCard[] = [
  { name: "Charizard Holo", set: "Base Set", tcgdexId: "base1-4", weight: 0.08, tier: "vintage", calPrice: 473.56, price: 473.56, change: 0.6, source: "tcgplayer" },
  { name: "Lugia Holo", set: "Neo Genesis", tcgdexId: "neo1-9", weight: 0.06, tier: "vintage", calPrice: 272.92, price: 272.92, change: -1.2, source: "cardmarket" },
  { name: "Blastoise Holo", set: "Base Set", tcgdexId: "base1-2", weight: 0.04, tier: "vintage", calPrice: 162.41, price: 162.41, change: 1.3, source: "tcgplayer" },
  { name: "Venusaur Holo", set: "Base Set", tcgdexId: "base1-15", weight: 0.04, tier: "vintage", calPrice: 133.09, price: 133.09, change: 0.3, source: "tcgplayer" },
  { name: "Umbreon Holo", set: "Neo Discovery", tcgdexId: "neo2-13", weight: 0.04, tier: "vintage", calPrice: 443.36, price: 443.36, change: -0.4, source: "tcgplayer" },
  { name: "Dark Charizard Holo", set: "Team Rocket", tcgdexId: "base5-4", weight: 0.04, tier: "vintage", calPrice: 127.00, price: 127.00, change: 1.8, source: "tcgplayer" },
  { name: "Dragonite Holo", set: "Fossil", tcgdexId: "base3-4", weight: 0.03, tier: "vintage", calPrice: 328.00, price: 328.00, change: -0.1, source: "tcgplayer" },
  { name: "Gengar Holo", set: "Fossil", tcgdexId: "base3-5", weight: 0.03, tier: "vintage", calPrice: 343.00, price: 343.00, change: 2.4, source: "tcgplayer" },
  { name: "Mewtwo Holo", set: "Base Set", tcgdexId: "base1-10", weight: 0.02, tier: "vintage", calPrice: 55.00, price: 55.00, change: 0.5, source: "tcgplayer" },
  { name: "Alakazam Holo", set: "Base Set", tcgdexId: "base1-1", weight: 0.02, tier: "vintage", calPrice: 60.00, price: 60.00, change: -0.3, source: "tcgplayer" },
];

export const ALL_CARDS: IndexCard[] = [...MODERN_CARDS, ...VINTAGE_CARDS];

export const CALIBRATION_BASKET = 418.41;

export const SETS_MODERN = ["Evolving Skies", "Obsidian Flames", "Fusion Strike", "Vivid Voltage", "Brilliant Stars", "Lost Origin", "Crown Zenith"] as const;
export const SETS_VINTAGE = ["Base Set", "Neo Genesis", "Neo Discovery", "Team Rocket", "Fossil"] as const;

// ============================================================================
// MARKET DEFAULTS
// ============================================================================
export const MARKET_CONFIG = {
  symbol: "PKMN-INDEX",
  version: "v3.0",
  maxLeverage: 5,
  initialMargin: 0.2,
  maintenanceMargin: 0.1,
  tradingFee: 0.0008,
  fundingPeriodMs: 3600000,
  minOrderSize: 10,
} as const;

// ============================================================================
// CANDLE DATA GENERATOR
// ============================================================================
const TF_INTERVALS: Record<string, number> = {
  "1H": 3600 * 1000,
  "4H": 4 * 3600 * 1000,
  "1D": 24 * 3600 * 1000,
  "1W": 7 * 24 * 3600 * 1000,
};

const TF_COUNTS: Record<string, number> = {
  "1H": 120,
  "4H": 90,
  "1D": 60,
  "1W": 52,
};

export function generateCandles(tf = "4H"): Candle[] {
  const candles: Candle[] = [];
  let price = 97.2;
  const now = Date.now();
  const count = TF_COUNTS[tf] || 90;
  const interval = TF_INTERVALS[tf] || 4 * 3600 * 1000;

  // Scale volatility to timeframe
  const volScale = Math.sqrt(interval / (4 * 3600 * 1000));

  const trends = [
    { start: 0, drift: 0.08 },
    { start: 15, drift: -0.12 },
    { start: 25, drift: 0.2 },
    { start: 40, drift: -0.05 },
    { start: 55, drift: 0.15 },
    { start: 70, drift: 0.08 },
    { start: 80, drift: -0.1 },
    { start: 85, drift: 0.12 },
  ];

  for (let i = 0; i < count; i++) {
    let drift = 0.08;
    for (const t of trends) if (i >= t.start) drift = t.drift;

    const o = price;
    const vol = (0.15 + Math.random() * 0.6) * volScale;
    const noise = (Math.random() - 0.48) * vol;
    const c = o + (drift * volScale) + noise;
    const h = Math.max(o, c) + Math.random() * 0.4 * volScale;
    const l = Math.min(o, c) - Math.random() * 0.4 * volScale;
    const v = 30000 + Math.random() * 120000;

    candles.push({
      time: now - (count - i) * interval,
      open: o,
      high: h,
      low: l,
      close: +c.toFixed(4),
      volume: v,
    });
    price = c;
  }
  return candles;
}

export function getMockMarketStats(currentPrice: number): MarketStats {
  return {
    price: currentPrice,
    change24h: ((currentPrice - 100) / 100) * 100,
    high24h: currentPrice * 1.012,
    low24h: currentPrice * 0.988,
    openInterest: 342800,
    fundingRate: 0.0034,
    volume24h: 1200000,
    nextFunding: 2843,
  };
}
