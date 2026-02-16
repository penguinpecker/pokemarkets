import {
  DriftClient,
  initialize,
  PositionDirection,
  OrderType as DriftOrderType,
  MarketType,
  getMarketOrderParams,
  BulkAccountLoader,
  User,
  convertToNumber,
  PRICE_PRECISION,
  QUOTE_PRECISION,
  BASE_PRECISION,
  BN,
  PerpMarketConfig,
  getUserAccountPublicKeySync,
} from "@drift-labs/sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

// ============================================================================
// CONFIG
// ============================================================================
const DRIFT_ENV = (process.env.NEXT_PUBLIC_DRIFT_ENV || "devnet") as "devnet" | "mainnet-beta";

let sdkConfig: ReturnType<typeof initialize> | null = null;

function getConfig() {
  if (!sdkConfig) {
    sdkConfig = initialize({ env: DRIFT_ENV });
  }
  return sdkConfig;
}

// ============================================================================
// DRIFT CLIENT SINGLETON
// ============================================================================
let driftClientInstance: DriftClient | null = null;
let driftUserInstance: User | null = null;

export async function initDriftClient(
  connection: Connection,
  wallet: AnchorWallet
): Promise<DriftClient> {
  // If already initialized with same wallet, return existing
  if (
    driftClientInstance &&
    driftClientInstance.wallet.publicKey.equals(wallet.publicKey)
  ) {
    return driftClientInstance;
  }

  // Cleanup previous
  if (driftClientInstance) {
    try {
      await driftClientInstance.unsubscribe();
    } catch {}
    driftClientInstance = null;
    driftUserInstance = null;
  }

  const config = getConfig();

  const bulkAccountLoader = new BulkAccountLoader(
    connection as any,
    "confirmed",
    1000
  );

  const driftClient = new DriftClient({
    connection: connection as any,
    wallet: wallet as any,
    programID: new PublicKey(config.DRIFT_PROGRAM_ID),
    env: DRIFT_ENV,
    accountSubscription: {
      type: "polling",
      accountLoader: bulkAccountLoader,
    },
  });

  await driftClient.subscribe();
  driftClientInstance = driftClient;

  return driftClient;
}

export function getDriftClient(): DriftClient | null {
  return driftClientInstance;
}

// ============================================================================
// USER ACCOUNT
// ============================================================================
export async function initUserAccount(
  driftClient: DriftClient
): Promise<{ exists: boolean; user: User | null }> {
  try {
    const config = getConfig();
    const programId = new PublicKey(config.DRIFT_PROGRAM_ID);
    const authority = driftClient.wallet.publicKey;

    // Derive PDA directly — doesn't require getUser() which throws if no account
    const userAccountPubkey = getUserAccountPublicKeySync(
      programId,
      authority,
      0 // sub-account 0
    );

    const bulkAccountLoader = new BulkAccountLoader(
      driftClient.connection as any,
      "confirmed",
      1000
    );

    const user = new User({
      driftClient,
      userAccountPublicKey: userAccountPubkey,
      accountSubscription: {
        type: "polling",
        accountLoader: bulkAccountLoader,
      },
    });

    const exists = await user.exists();

    if (exists) {
      await user.subscribe();
      driftUserInstance = user;
      return { exists: true, user };
    }

    return { exists: false, user: null };
  } catch (err) {
    console.error("Failed to init user account:", err);
    return { exists: false, user: null };
  }
}

export function getDriftUser(): User | null {
  return driftUserInstance;
}

// ============================================================================
// DEPOSIT / WITHDRAW
// ============================================================================
export async function ensureUserAccount(
  driftClient: DriftClient
): Promise<boolean> {
  const config = getConfig();
  const programId = new PublicKey(config.DRIFT_PROGRAM_ID);
  const authority = driftClient.wallet.publicKey;

  const pubkey = getUserAccountPublicKeySync(programId, authority, 0);
  const info = await driftClient.connection.getAccountInfo(pubkey);
  if (info) return true; // already exists

  console.log("[Drift] Creating user account on first action...");
  const [txSig] = await driftClient.initializeUserAccount(0);
  console.log("[Drift] Account created:", txSig);

  // Wait for confirmation then register user with client
  await new Promise((r) => setTimeout(r, 3000));
  await driftClient.addUser(0);
  return true;
}

export async function depositUSDC(
  driftClient: DriftClient,
  amountUsdc: number
): Promise<string> {
  await ensureUserAccount(driftClient);

  const config = getConfig();
  const usdcMint = new PublicKey(config.USDC_MINT_ADDRESS);
  const ata = await getAssociatedTokenAddress(
    usdcMint,
    driftClient.wallet.publicKey
  );

  const amountBN = new BN(Math.floor(amountUsdc * 1e6));

  const txSig = await driftClient.deposit(
    amountBN,
    0,
    ata
  );

  return txSig;
}

export async function withdrawUSDC(
  driftClient: DriftClient,
  amountUsdc: number
): Promise<string> {
  const config = getConfig();
  const usdcMint = new PublicKey(config.USDC_MINT_ADDRESS);
  const ata = await getAssociatedTokenAddress(
    usdcMint,
    driftClient.wallet.publicKey
  );

  const amountBN = new BN(Math.floor(amountUsdc * 1e6));

  const txSig = await driftClient.withdraw(
    amountBN,
    0, // spot market index for USDC
    ata
  );

  return txSig;
}

export async function depositSOL(
  driftClient: DriftClient,
  amountSol: number
): Promise<string> {
  await ensureUserAccount(driftClient);

  // SOL is spot market index 1, amount in lamports (9 decimals)
  const amountBN = new BN(Math.floor(amountSol * 1e9));

  // Pass wallet pubkey as ATA — SDK auto-wraps native SOL
  const txSig = await driftClient.deposit(
    amountBN,
    1, // spot market index for SOL
    driftClient.wallet.publicKey
  );

  return txSig;
}

// ============================================================================
// TRADING - PERP POSITIONS
// ============================================================================
export interface TradeParams {
  marketIndex: number;
  direction: "long" | "short";
  sizeUsd: number;
  orderType: "market" | "limit";
  limitPrice?: number;
}

export async function openPerpPosition(
  driftClient: DriftClient,
  params: TradeParams
): Promise<string> {
  await ensureUserAccount(driftClient);

  const direction =
    params.direction === "long"
      ? PositionDirection.LONG
      : PositionDirection.SHORT;

  // Get oracle price for the market
  const oraclePrice = driftClient.getOracleDataForPerpMarket(
    params.marketIndex
  );
  const price = convertToNumber(oraclePrice.price, PRICE_PRECISION);

  // Calculate base amount from USD size
  const baseAmount = params.sizeUsd / price;
  const baseAmountBN = new BN(
    Math.floor(baseAmount * BASE_PRECISION.toNumber())
  );

  if (params.orderType === "market") {
    const orderParams = getMarketOrderParams({
      marketIndex: params.marketIndex,
      direction,
      baseAssetAmount: baseAmountBN,
      marketType: MarketType.PERP,
    });

    const txSig = await driftClient.placeAndTakePerpOrder(orderParams);
    return txSig;
  } else {
    // Limit order
    const priceBN = new BN(
      Math.floor((params.limitPrice || price) * PRICE_PRECISION.toNumber())
    );

    const txSig = await driftClient.placePerpOrder({
      orderType: DriftOrderType.LIMIT,
      marketIndex: params.marketIndex,
      direction,
      baseAssetAmount: baseAmountBN,
      marketType: MarketType.PERP,
      price: priceBN,
    });

    return txSig;
  }
}

export async function closePerpPosition(
  driftClient: DriftClient,
  marketIndex: number
): Promise<string> {
  const txSig = await driftClient.closePosition(marketIndex);
  return txSig;
}

export async function cancelAllOrders(
  driftClient: DriftClient
): Promise<string> {
  const txSig = await driftClient.cancelOrders();
  return txSig;
}

// ============================================================================
// READING POSITIONS & BALANCES
// ============================================================================
export interface PerpPositionData {
  marketIndex: number;
  baseSize: number;
  quoteSize: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  direction: "long" | "short";
  liquidationPrice: number;
  leverage: number;
}

export function getUserPositions(user: User): PerpPositionData[] {
  try {
    const perpPositions = user.getActivePerpPositions();
    console.log("[Drift] Active perp positions found:", perpPositions.length);
    const positions: PerpPositionData[] = [];

    for (const pos of perpPositions) {
      const baseSize = convertToNumber(pos.baseAssetAmount, BASE_PRECISION);
      console.log("[Drift] Position raw:", {
        marketIndex: pos.marketIndex,
        baseAssetAmount: pos.baseAssetAmount.toString(),
        quoteAssetAmount: pos.quoteAssetAmount.toString(),
        baseSize,
        absBaseSize: Math.abs(baseSize),
        filtered: Math.abs(baseSize) < 0.0001,
      });
      if (Math.abs(baseSize) < 0.0001) continue;

      const quoteSize = convertToNumber(
        pos.quoteAssetAmount,
        QUOTE_PRECISION
      );
      const entryPrice =
        Math.abs(baseSize) > 0 ? Math.abs(quoteSize / baseSize) : 0;

      let markPrice = 0;
      let unrealizedPnl = 0;
      let liqPrice = 0;

      try {
        const oracleData = driftClientInstance?.getOracleDataForPerpMarket(
          pos.marketIndex
        );
        if (oracleData) {
          markPrice = convertToNumber(oracleData.price, PRICE_PRECISION);
        }
        unrealizedPnl = convertToNumber(
          user.getUnrealizedPNL(false, pos.marketIndex),
          QUOTE_PRECISION
        );
        liqPrice = convertToNumber(
          user.liquidationPrice(pos.marketIndex),
          PRICE_PRECISION
        );
      } catch {}

      const direction = baseSize > 0 ? "long" : "short";
      const totalCollateral = convertToNumber(
        user.getTotalCollateral(),
        QUOTE_PRECISION
      );
      const leverage =
        totalCollateral > 0
          ? Math.abs(baseSize * markPrice) / totalCollateral
          : 0;

      positions.push({
        marketIndex: pos.marketIndex,
        baseSize: Math.abs(baseSize),
        quoteSize: Math.abs(quoteSize),
        entryPrice,
        markPrice,
        unrealizedPnl,
        direction,
        liquidationPrice: liqPrice,
        leverage,
      });
    }

    return positions;
  } catch (err) {
    console.error("Failed to get positions:", err);
    return [];
  }
}

export function getUserCollateral(user: User): number {
  try {
    return convertToNumber(user.getTotalCollateral(), QUOTE_PRECISION);
  } catch {
    return 0;
  }
}

export function getUserFreeCollateral(user: User): number {
  try {
    return convertToNumber(user.getFreeCollateral(), QUOTE_PRECISION);
  } catch {
    return 0;
  }
}

export function getUserAccountLeverage(user: User): number {
  try {
    return convertToNumber(user.getLeverage(), new BN(10000));
  } catch {
    return 0;
  }
}

// ============================================================================
// MARKET DATA
// ============================================================================
export interface PerpMarketData {
  marketIndex: number;
  symbol: string;
  oraclePrice: number;
  fundingRate: number;
  openInterest: number;
  volume24h: number;
}

export function getAvailablePerpMarkets(): PerpMarketConfig[] {
  const config = getConfig();
  return config.PERP_MARKETS || [];
}

export function getPerpMarketData(
  driftClient: DriftClient,
  marketIndex: number
): PerpMarketData | null {
  try {
    const market = driftClient.getPerpMarketAccount(marketIndex);
    if (!market) return null;

    const oracleData = driftClient.getOracleDataForPerpMarket(marketIndex);
    const oraclePrice = convertToNumber(oracleData.price, PRICE_PRECISION);

    const fundingRate = convertToNumber(
      market.amm.lastFundingRate,
      PRICE_PRECISION
    );

    const oi = convertToNumber(
      market.amm.baseAssetAmountWithAmm,
      BASE_PRECISION
    );

    const config = getConfig();
    const marketConfig = config.PERP_MARKETS?.find(
      (m: PerpMarketConfig) => m.marketIndex === marketIndex
    );

    return {
      marketIndex,
      symbol: marketConfig?.symbol || `PERP-${marketIndex}`,
      oraclePrice,
      fundingRate,
      openInterest: Math.abs(oi) * oraclePrice,
      volume24h: 0, // Would need historical data
    };
  } catch {
    return null;
  }
}

// ============================================================================
// CLEANUP
// ============================================================================
export async function cleanupDrift() {
  if (driftUserInstance) {
    try {
      await driftUserInstance.unsubscribe();
    } catch {}
    driftUserInstance = null;
  }
  if (driftClientInstance) {
    try {
      await driftClientInstance.unsubscribe();
    } catch {}
    driftClientInstance = null;
  }
}

// ============================================================================
// DEVNET USDC FAUCET
// ============================================================================
const DRIFT_FAUCET_PROGRAM_ID = "V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB";

export async function airdropDevnetUSDC(
  connection: Connection,
  wallet: AnchorWallet,
  amountUsdc: number = 10_000
): Promise<string> {
  // Dynamic import to avoid bundling issues
  const { TokenFaucet } = await import("@drift-labs/sdk");
  const config = getConfig();
  const usdcMint = new PublicKey(config.USDC_MINT_ADDRESS);
  const faucetProgramId = new PublicKey(DRIFT_FAUCET_PROGRAM_ID);

  const faucet = new TokenFaucet(
    connection as any,
    wallet as any,
    faucetProgramId,
    usdcMint
  );

  const amountBN = new BN(Math.floor(amountUsdc * 1e6));
  const [ata, txSig] = await faucet.createAssociatedTokenAccountAndMintTo(
    wallet.publicKey,
    amountBN
  );
  console.log("[Drift] Airdropped", amountUsdc, "devnet USDC to ATA:", ata.toBase58(), "tx:", txSig);
  return txSig;
}
