import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_VERSIONS, TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de Uso · Gravaí" };

export default function TermosPage() {
  return <LegalPage title="Termos de Uso" version={LEGAL_VERSIONS.termos} sections={TERMS} />;
}
