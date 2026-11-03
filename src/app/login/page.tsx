"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CampoSenha, Entrada } from "@/components/gravai/entrada";
import { fillWithRec } from "@/components/gravai/palco";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

// Aviso para quem volta de um link de e-mail vencido (?aviso=link).
function LinkNotice() {
  const aviso = useSearchParams().get("aviso");
  if (aviso !== "link") return null;
  return <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">Esse link expirou ou já foi usado. Entre com sua senha ou peça um link novo.</p>;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    <Entrada title="Entrar no Gravaí">
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
          <CampoSenha id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
    </Entrada>
  );
}
