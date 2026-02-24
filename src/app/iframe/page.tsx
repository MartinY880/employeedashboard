import type { Metadata } from "next";
import { IframeHostClient } from "./IframeHostClient";

export const metadata: Metadata = {
  title: "Pros Mortgage Join",
  description: "Embedded Pros Mortgage join experience.",
};

export default function ProsMortgageJoinPage() {
  return (
    <main className="min-h-screen bg-black p-6 space-y-4">
      <IframeHostClient />
    </main>
  );
}
