"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl, authErrorMessage } from "@/lib/auth-errors";

// Esqueci minha senha: manda um link que volta para /nova-senha já com a sessão.
export default function EsqueciPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl(window.location.origin, "/nova-senha"),
    });
    // Por segurança, a resposta é a mesma exista ou não a conta (só erros de envio aparecem).
    if (error && error.code !== "user_not_found") setError(authErrorMessage(error));
    else setSent(true);
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-6 animate-scale-in">
        <Link href="/" aria-label="Início" className="text-center">
          <Logo className="text-4xl" />
        </Link>
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-6">
          <h1 className="text-xl font-bold">Esqueci minha senha</h1>
          {sent ? (
            <>
              <p className="leading-relaxed text-muted-foreground">
                Se existir uma conta com <strong className="text-foreground">{email.trim()}</strong>, mandamos um link para criar
                uma senha nova. Abra no celular e siga por lá.
              </p>
              <p className="text-sm text-muted-foreground">Não chegou? Olhe a caixa de spam ou promoções.</p>
            </>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-3">
              <p className="leading-relaxed text-muted-foreground">Coloque o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</p>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">E-mail</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-12 rounded-xl border border-input bg-background px-3.5 text-base outline-none focus:border-foreground"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || !email.trim()} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
                {busy ? "Enviando…" : "Mandar o link"}
              </button>
            </form>
          )}
        </div>
        <Link href="/login" className="text-center text-sm font-semibold underline">
          Voltar para entrar
        </Link>
      </div>
    </div>
  );
}
