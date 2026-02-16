"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useMemo } from "react";
import { CardDeck } from "@/components/ui/CardDeck";
import { OracleStatus } from "@/components/trading/OracleStatus";
const NAV_ITEMS = ["Portfolio", "Markets", "Earn"];
export function Header() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const shortAddress = useMemo(() => { if (!publicKey) return ""; const addr = publicKey.toBase58(); return addr.slice(0, 4) + "..." + addr.slice(-4); }, [publicKey]);
  const handleClick = useCallback(() => { if (connected) { disconnect(); } else { setVisible(true); } }, [connected, disconnect, setVisible]);
  return (
    <header className="flex items-center justify-between px-6 py-2.5 bg-gradient-to-b from-[#12101f] to-surface-base border-b border-border shadow-[0_4px_30px_rgba(255,203,5,0.04)]">
      <div className="flex items-center gap-2.5">
        <CardDeck size={38} />
        <div>
          <span className="font-display text-2xl text-pkmn-yellow tracking-wide drop-shadow-[0_0_20px_rgba(255,203,5,0.3)]">Poke</span>
          <span className="font-display text-2xl text-pkmn-white/85 ml-0.5 drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">Markets</span>
        </div>
        <div className="bg-pkmn-yellow-glow border border-pkmn-yellow/20 rounded-full px-2.5 py-0.5 text-[9px] text-pkmn-yellow font-extrabold tracking-widest animate-glow-pulse">DEVNET</div>
      </div>
      <OracleStatus />
      <div className="flex items-center gap-2">
        {NAV_ITEMS.map((item) => (<button key={item} className="bg-transparent border border-border text-txt-mid px-3.5 py-1.5 rounded-full text-xs font-bold font-body hover:border-border-light hover:text-txt-primary transition-colors">{item}</button>))}
        <button onClick={handleClick} className={"px-5 py-2 rounded-3xl text-xs font-black font-body transition-all " + (connected ? "bg-surface-elevated border border-pkmn-yellow text-pkmn-yellow hover:bg-surface-elevated/80" : "bg-gradient-to-r from-pkmn-yellow to-[#FFD740] text-surface-base border-none shadow-glow-yellow hover:shadow-[0_0_30px_rgba(255,203,5,0.3)]")}>{connected ? "\u25C9 " + shortAddress : "Connect Wallet"}</button>
      </div>
    </header>
  );
}
