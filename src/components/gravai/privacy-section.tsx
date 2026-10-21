"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COMPANY } from "@/lib/legal";

// Perfil › Privacidade e dados: os direitos do titular (LGPD, art. 18) ao alcance de um toque.
export function PrivacySection() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const db = createClient();
    const { error } = await db.rpc("delete_my_account");
    if (error) {
      setError("Não deu para excluir a conta agora. Tente de novo ou escreva para " + COMPANY.email + ".");
      setBusy(false);
      return;
    }
    await db.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <section aria-labelledby="privacidade" className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <h2 id="privacidade" className="font-bold">
        Privacidade e dados
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        As sugestões são geradas por inteligência artificial (Google Gemini e Groq). Não coloque dados pessoais sensíveis nos textos.
      </p>
      <div className="flex flex-wrap gap-x-5 text-sm font-semibold">
        <Link href="/termos" className="flex min-h-11 items-center underline">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="flex min-h-11 items-center underline">
          Política de Privacidade
        </Link>
      </div>

      <a href="/api/meus-dados" download className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-semibold">
        <Download className="size-5" strokeWidth={1.75} aria-hidden="true" />
        Baixar meus dados
      </a>

      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-destructive">
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Excluir minha conta
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-3">
          <p className="text-sm leading-relaxed">
            Isso apaga <strong>para sempre</strong> sua conta, todos os vídeos, roteiros, planos, pessoas convidadas e autorizações recebidas.
            Se quiser, baixe seus dados antes.
          </p>
          <label className="flex flex-col gap-1.5 text-sm">
            <span>
              Para confirmar, escreva <strong>EXCLUIR</strong>
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              className="min-h-12 rounded-xl border border-input bg-background px-3.5 text-base outline-none focus:border-foreground"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={typed.trim().toUpperCase() !== "EXCLUIR" || busy}
              className="min-h-12 flex-1 rounded-full bg-destructive font-bold text-white disabled:opacity-40"
            >
              {busy ? "Excluindo…" : "Excluir para sempre"}
            </button>
            <button type="button" onClick={() => { setConfirming(false); setTyped(""); }} className="min-h-12 rounded-full px-4 font-semibold">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
