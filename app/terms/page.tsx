import type { Metadata } from "next";
import { LegalView } from "@/components/legal/legal-view";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service and usage conditions for Raymarkable.",
};

export default function TermsPage() {
  return <LegalView initialTab="terms" />;
}
