import type { Metadata } from "next";
import { LegalView } from "@/components/legal/legal-view";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy and transparency details for Raymarkable.",
};

export default function PrivacyPage() {
  return <LegalView initialTab="privacy" />;
}
