"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import type { DriftClient, User } from "@drift-labs/sdk";
import {
  initDriftClient,
  initUserAccount,
  getUserPositions,
  getUserCollateral,
  getUserFreeCollateral,
  getUserAccountLeverage,
  openPerpPosition,
  closePerpPosition,
  depositUSDC,
  depositSOL,
  withdrawUSDC,
  getPerpMarketData,
  cleanupDrift,
  airdropDevnetUSDC,
  type PerpPositionData,
  type PerpMarketData,
  type TradeParams,
} from "@/lib/drift";

// ============================================================================
// CONTEXT TYPE
// ============================================================================
export interface DriftContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  hasAccount: boolean;
  error: string | null;

  collateral: number;
  freeCollateral: number;
  accountLeverage: number;
  positions: PerpPositionData[];
  marketData: PerpMarketData | null;

  deposit: (amount: number) => Promise<string | null>;
  depositSol: (amount: number) => Promise<string | null>;
  withdraw: (amount: number) => Promise<string | null>;
  openPosition: (params: TradeParams) => Promise<string | null>;
  closePosition: (marketIndex: number) => Promise<string | null>;
  airdropUSDC: (amount?: number) => Promise<string | null>;
  refreshPositions: () => void;
  refreshMarketData: (marketIndex: number) => void;
}

const DriftContext = createContext<DriftContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================
export function DriftProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { connected } = useWallet();
  const anchorWallet = useAnchorWallet();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collateral, setCollateral] = useState(0);
  const [freeCollateral, setFreeCollateral] = useState(0);
  const [accountLeverage, setAccountLeverage] = useState(0);
  const [positions, setPositions] = useState<PerpPositionData[]>([]);
  const [marketData, setMarketData] = useState<PerpMarketData | null>(null);

  const clientRef = useRef<DriftClient | null>(null);
  const userRef = useRef<User | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initAttemptedRef = useRef(false);

  // ========================================================================
  // REFRESH HELPERS
  // ========================================================================
  const refreshBalances = useCallback((user: User) => {
    try {
      setCollateral(getUserCollateral(user));
      setFreeCollateral(getUserFreeCollateral(user));
      setAccountLeverage(getUserAccountLeverage(user));
    } catch (err) {
      console.warn("Failed to refresh balances:", err);
    }
  }, []);

  const refreshPositionsFromUser = useCallback((user: User) => {
    try {
      const pos = getUserPositions(user);
      console.log("[Drift] Setting positions state:", pos.length, pos);
      setPositions(pos);
    } catch (err) {
      console.warn("Failed to refresh positions:", err);
    }
  }, []);

  const refreshPositions = useCallback(async () => {
    if (userRef.current) {
      try {
        // Force re-fetch account data from chain first
        await userRef.current.fetchAccounts();
      } catch (err) {
        console.warn("[Drift] fetchAccounts failed:", err);
      }
      refreshBalances(userRef.current);
      refreshPositionsFromUser(userRef.current);
    }
  }, [refreshBalances, refreshPositionsFromUser]);

  const refreshMarketData = useCallback((marketIndex: number) => {
    if (clientRef.current) {
      const data = getPerpMarketData(clientRef.current, marketIndex);
      setMarketData(data);
    }
  }, []);

  // ========================================================================
  // INITIALIZE
  // ========================================================================
  useEffect(() => {
    if (!connected || !anchorWallet || !connection) return;
    if (isInitialized || isInitializing) return;
    if (initAttemptedRef.current) return;

    initAttemptedRef.current = true;

    const init = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        console.log("[Drift] Initializing client...");
        const client = await initDriftClient(connection, anchorWallet);
        clientRef.current = client;
        console.log("[Drift] Client subscribed ✓");

        // Fetch market data for SOL-PERP (index 0)
        try {
          const data = getPerpMarketData(client, 0);
          if (data) setMarketData(data);
          console.log("[Drift] Market data loaded:", data?.symbol);
        } catch (err) {
          console.warn("[Drift] Market data fetch failed:", err);
        }

        // Check user account
        console.log("[Drift] Checking user account...");
        const { exists, user } = await initUserAccount(client);
        setHasAccount(exists);
        console.log("[Drift] User account exists:", exists);

        if (exists && user) {
          userRef.current = user;
          await refreshPositions();
        }

        setIsInitialized(true);
        console.log("[Drift] Initialization complete ✓");
      } catch (err: any) {
        console.error("[Drift] Init error:", err);
        setError(err?.message || "Failed to connect to Drift");
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [connected, anchorWallet, connection, isInitialized, isInitializing, refreshBalances, refreshPositionsFromUser]);

  // Cleanup on disconnect
  useEffect(() => {
    if (!connected) {
      setIsInitialized(false);
      setIsInitializing(false);
      setHasAccount(false);
      setPositions([]);
      setCollateral(0);
      setFreeCollateral(0);
      setAccountLeverage(0);
      setMarketData(null);
      setError(null);
      clientRef.current = null;
      userRef.current = null;
      initAttemptedRef.current = false;

      if (pollRef.current) clearInterval(pollRef.current);
      cleanupDrift();
    }
  }, [connected]);

  // Poll positions
  useEffect(() => {
    if (isInitialized && hasAccount && userRef.current) {
      pollRef.current = setInterval(async () => {
        await refreshPositions();
        // Also refresh market data
        if (clientRef.current) {
          try {
            const data = getPerpMarketData(clientRef.current, 0);
            if (data) setMarketData(data);
          } catch {}
        }
      }, 5000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [isInitialized, hasAccount, refreshPositions]);

  // ========================================================================
  // ACTIONS
  // ========================================================================
  const deposit = useCallback(
    async (amount: number): Promise<string | null> => {
      if (!clientRef.current) {
        setError("Drift not initialized");
        return null;
      }
      setError(null);
      try {
        console.log("[Drift] Depositing", amount, "USDC...");
        const txSig = await depositUSDC(clientRef.current, amount);
        console.log("[Drift] Deposit tx:", txSig);

        // Account may have been auto-created — re-init user
        if (!hasAccount) {
          await new Promise((r) => setTimeout(r, 2000));
          const { exists, user } = await initUserAccount(clientRef.current);
          if (exists && user) {
            userRef.current = user;
            setHasAccount(true);
            await refreshPositions();
          }
        } else {
          await refreshPositions();
          setTimeout(refreshPositions, 3000);
        }

        return txSig;
      } catch (err: any) {
        console.error("[Drift] Deposit error:", err);
        setError(err?.message || "Deposit failed");
        return null;
      }
    },
    [refreshPositions, hasAccount]
  );

  const depositSolCallback = useCallback(
    async (amount: number): Promise<string | null> => {
      if (!clientRef.current) {
        setError("Drift not initialized");
        return null;
      }
      setError(null);
      try {
        console.log("[Drift] Depositing", amount, "SOL...");
        const txSig = await depositSOL(clientRef.current, amount);
        console.log("[Drift] SOL Deposit tx:", txSig);

        if (!hasAccount) {
          await new Promise((r) => setTimeout(r, 2000));
          const { exists, user } = await initUserAccount(clientRef.current);
          if (exists && user) {
            userRef.current = user;
            setHasAccount(true);
            await refreshPositions();
          }
        } else {
          await refreshPositions();
          setTimeout(refreshPositions, 3000);
        }

        return txSig;
      } catch (err: any) {
        console.error("[Drift] SOL Deposit error:", err);
        setError(err?.message || "SOL Deposit failed");
        return null;
      }
    },
    [refreshPositions, hasAccount]
  );

  const withdraw = useCallback(
    async (amount: number): Promise<string | null> => {
      if (!clientRef.current) {
        setError("Drift not initialized");
        return null;
      }
      setError(null);
      try {
        const txSig = await withdrawUSDC(clientRef.current, amount);
        setTimeout(refreshPositions, 3000);
        return txSig;
      } catch (err: any) {
        setError(err?.message || "Withdrawal failed");
        return null;
      }
    },
    [refreshPositions]
  );

  const openPosition = useCallback(
    async (params: TradeParams): Promise<string | null> => {
      if (!clientRef.current) {
        setError("Drift not initialized");
        return null;
      }
      setError(null);
      try {
        console.log("[Drift] Opening position:", params);
        const txSig = await openPerpPosition(clientRef.current, params);
        console.log("[Drift] Trade tx:", txSig);

        // Account may have been auto-created
        if (!hasAccount) {
          await new Promise((r) => setTimeout(r, 2000));
          const { exists, user } = await initUserAccount(clientRef.current);
          if (exists && user) {
            userRef.current = user;
            setHasAccount(true);
            await refreshPositions();
          }
        } else {
          // Immediate refresh + delayed retry
          await refreshPositions();
          setTimeout(refreshPositions, 3000);
        }

        return txSig;
      } catch (err: any) {
        console.error("[Drift] Trade error:", err);
        setError(err?.message || "Trade failed");
        return null;
      }
    },
    [refreshPositions, hasAccount]
  );

  const closePosition = useCallback(
    async (marketIndex: number): Promise<string | null> => {
      if (!clientRef.current) {
        setError("Drift not initialized");
        return null;
      }
      setError(null);
      try {
        const txSig = await closePerpPosition(clientRef.current, marketIndex);
        await refreshPositions();
        setTimeout(refreshPositions, 3000);
        return txSig;
      } catch (err: any) {
        setError(err?.message || "Close failed");
        return null;
      }
    },
    [refreshPositions]
  );

  const airdropUSDC = useCallback(
    async (amount: number = 10_000): Promise<string | null> => {
      if (!anchorWallet) {
        setError("Wallet not connected");
        return null;
      }
      setError(null);
      try {
        console.log("[Drift] Airdropping", amount, "devnet USDC...");
        const txSig = await airdropDevnetUSDC(connection, anchorWallet, amount);
        console.log("[Drift] Airdrop tx:", txSig);
        // Refresh balances after airdrop
        setTimeout(refreshPositions, 3000);
        return txSig;
      } catch (err: any) {
        console.error("[Drift] Airdrop error:", err);
        setError(err?.message || "Airdrop failed");
        return null;
      }
    },
    [anchorWallet, connection, refreshPositions]
  );

  return (
    <DriftContext.Provider
      value={{
        isInitialized,
        isInitializing,
        hasAccount,
        error,
        collateral,
        freeCollateral,
        accountLeverage,
        positions,
        marketData,
        deposit,
        depositSol: depositSolCallback,
        withdraw,
        openPosition,
        closePosition,
        airdropUSDC,
        refreshPositions,
        refreshMarketData,
      }}
    >
      {children}
    </DriftContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================
export function useDrift(): DriftContextType {
  const ctx = useContext(DriftContext);
  if (!ctx) {
    throw new Error("useDrift must be used within <DriftProvider>");
  }
  return ctx;
}
