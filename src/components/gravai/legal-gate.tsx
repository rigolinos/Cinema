"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pendingDocuments } from "@/lib/legal";

// Quem ainda não aceitou a versão atual dos Termos ou da Política vai para /aceite.
export function LegalGate() {
  const router = useRouter();
  useEffect(() => {
    createClient()
      .from("legal_acceptances")
      .select("document, version")
      .then(({ data, error }) => {
        if (!error && pendingDocuments(data ?? []).length > 0) router.replace("/aceite");
      });
  }, [router]);
  return null;
}
