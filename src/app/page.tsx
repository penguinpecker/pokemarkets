"use client";

import dynamic from "next/dynamic";

const TradingPage = dynamic(
  () => import("@/components/TradingPage"),
  { ssr: false }
);

export default function Page() {
  return <TradingPage />;
}
