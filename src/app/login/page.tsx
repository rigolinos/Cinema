"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Palco, fillWithRec } from "@/components/gravai/palco";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

// Aviso para quem volta de um link de e-mail vencido (?aviso=link).
function LinkNotice() {
  const aviso = useSearchParams().get("aviso");
  if (aviso !== "link") return null;
  return <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">Esse link expirou ou já foi usado. Entre com sua senha ou peça um link novo.</p>;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compact, setCompact] = useState(false); // digitando: a marca encolhe e o fundo para
  const router = useRouter();
  const sheet = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);

  // Só volta ao palco grande depois do toque terminar: se o layout mudasse no meio do toque,
  // o botão sairia de baixo do dedo.
  function settle() {
    setTimeout(() => {
      if (pressing.current) return;
      if (!(document.activeElement instanceof HTMLInputElement && sheet.current?.contains(document.activeElement))) setCompact(false);
    }, 150);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(authErrorMessage(error));
      setLoading(false);
    } else {
      fillWithRec();
      router.push("/inicio");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0E0E0E]">
      <h1 className="sr-only">Entrar no Gravaí</h1>
      <Palco compact={compact} />

      <div
        ref={sheet}
        onFocusCapture={(e) => {
          if (e.target instanceof HTMLInputElement) setCompact(true);
        }}
        onBlurCapture={settle}
        onPointerDownCapture={() => {
          pressing.current = true;
        }}
        onPointerUpCapture={() => {
          pressing.current = false;
          settle();
        }}
        onPointerCancelCapture={() => {
          pressing.current = false;
        }}
        className={cn("folha-sobe relative rounded-t-[1.625rem] bg-background pb-[env(safe-area-inset-bottom)]", compact && "flex-1")}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-5 pb-5 pt-6">
          <Suspense fallback={null}>
            <LinkNotice />
          </Suspense>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-card text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-card pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Esconder a senha" : "Mostrar a senha"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="size-5" strokeWidth={1.75} aria-hidden="true" /> : <Eye className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="mt-1 h-13 w-full rounded-full text-base font-bold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <Link href="/register" className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
            Criar conta grátis
          </Link>
          <Link href="/esqueci" className="flex min-h-11 items-center justify-center self-center px-2 text-sm text-muted-foreground underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
