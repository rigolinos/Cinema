import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_VERSIONS, PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de Privacidade · Gravaí" };

export default function PrivacidadePage() {
  return <LegalPage title="Política de Privacidade" version={LEGAL_VERSIONS.privacidade} sections={PRIVACY} />;
}
