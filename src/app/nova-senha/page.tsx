"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

// Chega aqui pelo link do e-mail (já com a sessão aberta pela /auth/callback).
export default function NovaSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      setError("As duas senhas não são iguais.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(authErrorMessage(error));
      setBusy(false);
      return;
    }
    router.push("/inicio");
    router.refresh();
  }

  const field = "min-h-12 rounded-xl border border-input bg-background px-3.5 text-base outline-none focus:border-foreground";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-6 animate-scale-in">
        <div className="text-center">
          <Logo className="text-4xl" />
        </div>
        <form onSubmit={save} className="flex flex-col gap-4 rounded-2xl bg-card p-6">
          <h1 className="text-xl font-bold">Crie uma senha nova</h1>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Senha nova</span>
            <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Repita a senha</span>
            <input type="password" required minLength={6} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={field} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !password || !repeat} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
            {busy ? "Salvando…" : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
