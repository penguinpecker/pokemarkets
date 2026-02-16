import type { Metadata } from "next";
import { QueryProvider } from "@/providers/QueryProvider";
import { WalletProvider } from "@/providers/WalletProvider";
import { DriftProvider } from "@/providers/DriftProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PokeMarkets — Pokémon Card Perpetual Futures",
  description:
    "Trade perpetual futures on a basket of vintage 1st-gen Pokémon cards. Powered by Drift Protocol on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased" suppressHydrationWarning>
        <WalletProvider>
          <DriftProvider>
            <QueryProvider>{children}</QueryProvider>
          </DriftProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
