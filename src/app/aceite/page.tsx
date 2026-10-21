"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { LEGAL_VERSIONS, pendingDocuments, type LegalDocument } from "@/lib/legal";

const NAMES: Record<LegalDocument, { label: string; href: string }> = {
  termos: { label: "Termos de Uso", href: "/termos" },
  privacidade: { label: "Política de Privacidade", href: "/privacidade" },
};

// Aceite dos documentos legais: para quem já tinha conta ou quando um texto muda de versão.
export default function AceitePage() {
  const router = useRouter();
  const [pending, setPending] = useState<LegalDocument[] | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("legal_acceptances")
      .select("document, version")
      .then(({ data }) => {
        const docs = pendingDocuments(data ?? []);
        if (docs.length === 0) router.replace("/inicio");
        else setPending(docs);
      });
  }, [router]);

  async function accept() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from("legal_acceptances")
      .upsert(
        pending.map((document) => ({ document, version: LEGAL_VERSIONS[document] })),
        { onConflict: "user_id,document,version", ignoreDuplicates: true },
      );
    if (error) {
      setError("Não deu para registrar o aceite. Tente de novo.");
      setBusy(false);
      return;
    }
    router.replace("/inicio");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <Logo className="text-4xl" />
        </div>
        {pending && (
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-6">
            <h1 className="text-xl font-bold">Antes de continuar</h1>
            <p className="leading-relaxed text-muted-foreground">
              Para usar o Gravaí, leia e aceite {pending.length > 1 ? "os documentos abaixo" : "o documento abaixo"}. Eles explicam como
              o app funciona e o que fazemos com os seus dados.
            </p>
            <ul className="flex flex-col gap-1">
              {pending.map((doc) => (
                <li key={doc}>
                  <Link href={NAMES[doc].href} target="_blank" className="inline-flex min-h-11 items-center font-semibold underline">
                    {NAMES[doc].label}
                  </Link>
                </li>
              ))}
            </ul>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-foreground" />
              Li e aceito {pending.map((d) => NAMES[d].label).join(" e ")}.
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button type="button" onClick={accept} disabled={!agree || busy} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
              {busy ? "Salvando…" : "Aceitar e continuar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
