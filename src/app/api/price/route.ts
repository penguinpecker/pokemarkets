import { NextResponse } from "next/server";

/**
 * GET /api/price — PKMN-INDEX v3.0
 *
 * Simulated price endpoint for the Switchboard oracle job.
 * In production, fetches from TCGdex → TCGPlayer/Cardmarket.
 * For devnet, returns simulated prices with slight noise.
 */

const BASE_INDEX = 100;

function simulateIndex() {
  // Modern (60%) and Vintage (40%) with slight noise
  const modernNoise = 1 + (Math.random() - 0.5) * 0.04;
  const vintageNoise = 1 + (Math.random() - 0.5) * 0.02;

  const modernComponent = 0.6 * modernNoise * BASE_INDEX;
  const vintageComponent = 0.4 * vintageNoise * BASE_INDEX;
  const index = modernComponent + vintageComponent;

  const confidence = Math.max(0.1, index * 0.004);

  return {
    index: parseFloat(index.toFixed(6)),
    modernComponent: parseFloat(modernComponent.toFixed(4)),
    vintageComponent: parseFloat(vintageComponent.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(6)),
    timestamp: Date.now(),
  };
}

export async function GET() {
  try {
    const data = simulateIndex();
    return NextResponse.json({
      ...data,
      symbol: "PKMN-INDEX",
      version: "3.0.0",
      sources: {
        modern: { weight: 0.6, provider: "TCGPlayer", cards: 11 },
        vintage: { weight: 0.4, provider: "TCGPlayer + Cardmarket", cards: 10 },
      },
      smoothing: { algorithm: "EMT", alpha: 0.003, maxTickJump: 0.001 },
      status: "valid",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to compute index", status: "error" },
      { status: 500 }
    );
  }
}
