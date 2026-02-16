import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

interface IndexCard {
  id: string;
  name: string;
  set: string;
  weight: number;
  tier: "modern" | "vintage";
}

// ═══════════════════════════════════════════════════════════════
// PKMN-INDEX v3.0 — 21 Cards | 60% Modern / 40% Vintage
// Calibration basket: $418.41 = Index 100.00
// ═══════════════════════════════════════════════════════════════

const INDEX_CARDS: IndexCard[] = [
  // MODERN — 60% (11 cards)
  { id: "sv03-125", name: "Charizard ex", set: "Obsidian Flames", weight: 0.08, tier: "modern" },
  { id: "swsh7-215", name: "Umbreon VMAX Alt Art", set: "Evolving Skies", weight: 0.07, tier: "modern" },
  { id: "swsh11-131", name: "Giratina VSTAR Alt Art", set: "Lost Origin", weight: 0.06, tier: "modern" },
  { id: "swsh7-218", name: "Rayquaza VMAX Alt Art", set: "Evolving Skies", weight: 0.06, tier: "modern" },
  { id: "swsh4-188", name: "Pikachu VMAX Rainbow", set: "Vivid Voltage", weight: 0.05, tier: "modern" },
  { id: "swsh7-189", name: "Umbreon V Alt Art", set: "Evolving Skies", weight: 0.05, tier: "modern" },
  { id: "swsh7-209", name: "Glaceon VMAX Alt Art", set: "Evolving Skies", weight: 0.05, tier: "modern" },
  { id: "swsh8-269", name: "Mew VMAX Alt Art", set: "Fusion Strike", weight: 0.05, tier: "modern" },
  { id: "sv03-223", name: "Charizard ex SAR", set: "Obsidian Flames", weight: 0.05, tier: "modern" },
  { id: "swsh9-174", name: "Charizard VSTAR Rainbow", set: "Brilliant Stars", weight: 0.05, tier: "modern" },
  { id: "swsh12pt5gg-GG70", name: "Charizard UPC Promo", set: "Crown Zenith", weight: 0.03, tier: "modern" },
  // VINTAGE — 40% (10 cards)
  { id: "base1-4", name: "Charizard Holo", set: "Base Set", weight: 0.08, tier: "vintage" },
  { id: "neo1-9", name: "Lugia Holo", set: "Neo Genesis", weight: 0.06, tier: "vintage" },
  { id: "base1-2", name: "Blastoise Holo", set: "Base Set", weight: 0.04, tier: "vintage" },
  { id: "base1-15", name: "Venusaur Holo", set: "Base Set", weight: 0.04, tier: "vintage" },
  { id: "neo2-13", name: "Umbreon Holo", set: "Neo Discovery", weight: 0.04, tier: "vintage" },
  { id: "base5-4", name: "Dark Charizard Holo", set: "Team Rocket", weight: 0.04, tier: "vintage" },
  { id: "base3-4", name: "Dragonite Holo", set: "Fossil", weight: 0.03, tier: "vintage" },
  { id: "base3-5", name: "Gengar Holo", set: "Fossil", weight: 0.03, tier: "vintage" },
  { id: "base1-10", name: "Mewtwo Holo", set: "Base Set", weight: 0.02, tier: "vintage" },
  { id: "base1-1", name: "Alakazam Holo", set: "Base Set", weight: 0.02, tier: "vintage" },
];

// Calibration prices — snapshot when Index = 100.00
const BASELINE_PRICES: Record<string, number> = {
  // Modern
  "sv03-125": 80.00, "swsh7-215": 1730.00, "swsh11-131": 160.00,
  "swsh7-218": 659.00, "swsh4-188": 143.85, "swsh7-189": 299.02,
  "swsh7-209": 261.48, "swsh8-269": 181.00, "sv03-223": 150.00,
  "swsh9-174": 61.92, "swsh12pt5gg-GG70": 120.00,
  // Vintage
  "base1-4": 473.56, "neo1-9": 272.92, "base1-2": 162.41,
  "base1-15": 133.09, "neo2-13": 443.36, "base5-4": 127.00,
  "base3-4": 328.00, "base3-5": 343.00, "base1-10": 55.00,
  "base1-1": 60.00,
};

const TCGDEX_BASE = "https://api.tcgdex.net/v2/en/cards";

function extractUSDPrice(pricing: Record<string, unknown>): number | null {
  const tcp = pricing?.tcgplayer as Record<string, unknown> | undefined;
  if (!tcp) return null;
  for (const [key, v] of Object.entries(tcp)) {
    if (key === "updated" || key === "unit") continue;
    const variant = v as Record<string, number>;
    if (variant?.marketPrice && variant.marketPrice > 0) return variant.marketPrice;
  }
  for (const [key, v] of Object.entries(tcp)) {
    if (key === "updated" || key === "unit") continue;
    const variant = v as Record<string, number>;
    if (variant?.lowPrice && variant.lowPrice > 0) return variant.lowPrice;
  }
  return null;
}

function extractEURPrice(pricing: Record<string, unknown>): number | null {
  const cm = pricing?.cardmarket as Record<string, number> | undefined;
  if (!cm) return null;
  const avg = cm.avg;
  if (avg && avg > 0) return avg * 1.08; // EUR→USD
  const trend = cm.trend;
  if (trend && trend > 0) return trend * 1.08;
  return null;
}

async function fetchCardPrice(cardId: string) {
  try {
    const res = await fetch(TCGDEX_BASE + "/" + cardId, { cache: "no-store" });
    if (!res.ok) return { price: null, source: "error", updated: null };
    const data = await res.json();
    const pricing = (data.pricing || {}) as Record<string, unknown>;
    const usdPrice = extractUSDPrice(pricing);
    if (usdPrice !== null) {
      const tcp = pricing.tcgplayer as Record<string, string> | undefined;
      return { price: usdPrice, source: "tcgplayer", updated: tcp?.updated || null };
    }
    const eurPrice = extractEURPrice(pricing);
    if (eurPrice !== null) {
      const cm = pricing.cardmarket as Record<string, string> | undefined;
      return { price: eurPrice, source: "cardmarket", updated: cm?.updated || null };
    }
    return { price: null, source: "none", updated: null };
  } catch {
    console.error("[Oracle] Fetch failed for " + cardId);
    return { price: null, source: "error", updated: null };
  }
}

export async function GET() {
  try {
    const results = await Promise.all(
      INDEX_CARDS.map(async (card) => {
        const r = await fetchCardPrice(card.id);
        return { card, ...r };
      })
    );

    let weightedSum = 0;
    let totalWeight = 0;
    const cards: {
      id: string; name: string; set: string; tier: string;
      price: number | null; baseline: number; weight: number;
      source: string; updated: string | null;
    }[] = [];

    for (const r of results) {
      const baseline = BASELINE_PRICES[r.card.id] || 100;
      cards.push({
        id: r.card.id, name: r.card.name, set: r.card.set,
        tier: r.card.tier, price: r.price, baseline,
        weight: r.card.weight, source: r.source, updated: r.updated,
      });
      if (r.price !== null && r.price > 0) {
        weightedSum += r.card.weight * (r.price / baseline);
        totalWeight += r.card.weight;
      }
    }

    const indexValue = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
    const successCount = cards.filter((c) => c.price !== null).length;
    const lastUpdated = results
      .filter((r) => r.updated)
      .map((r) => r.updated!)
      .sort()
      .pop();

    const modernCards = cards.filter((c) => c.tier === "modern");
    const vintageCards = cards.filter((c) => c.tier === "vintage");

    return NextResponse.json(
      {
        result: parseFloat(indexValue.toFixed(4)),
        index: parseFloat(indexValue.toFixed(4)),
        symbol: "PKMN-INDEX",
        constituents: cards.length,
        priced: successCount,
        composition: {
          modern: { cards: modernCards.length, weight: "60%", priced: modernCards.filter(c => c.price !== null).length },
          vintage: { cards: vintageCards.length, weight: "40%", priced: vintageCards.filter(c => c.price !== null).length },
        },
        cards,
        calibrationBasket: 418.41,
        dataSource: "tcgdex.net",
        lastUpdated,
        methodology: "Market-cap weighted index of 21 Pokemon TCG cards (60% modern alt arts, 40% vintage WOTC holos). Index = 100 at calibration.",
        status: successCount >= 15 ? "valid" : "degraded",
        version: "3.0.0",
        timestamp: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to compute index";
    return NextResponse.json(
      { result: 0, error: message, status: "error" },
      { status: 500 }
    );
  }
}
