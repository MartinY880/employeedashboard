import type { Metadata } from "next";
import { IframeHostClient } from "./IframeHostClient";

export const metadata: Metadata = {
  title: "Pros Mortgage Join",
  description: "Embedded Pros Mortgage join experience.",
};

export default function ProsMortgageJoinPage() {
  return <IframeHostClient />;
}
