"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CampoSenha, Entrada } from "@/components/gravai/entrada";
import { fillWithRec } from "@/components/gravai/palco";
import { authCallbackUrl, authErrorMessage, safeNext } from "@/lib/auth-errors";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

// Quem chega pelo convite de outra pessoa já encontra o nome preenchido.
export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0E0E0E]" />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const params = useSearchParams();
  const fromInvite = params.get("origem") === "convite";
  // Para onde volta depois de entrar: quem veio salvar um convite retorna a ele.
  const next = safeNext(params.get("next"));
  const loginHref = next === "/inicio" ? "/login" : `/login?${new URLSearchParams({ next })}`;
  const [name, setName] = useState(() => (params.get("nome") ?? "").slice(0, 80));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(window.location.origin, next),
        data: {
          full_name: name,
          org_name: `Estúdio de ${name.trim().split(/\s+/)[0] || "você"}`,
          // Versões aceitas: o banco registra o aceite junto com a criação da conta.
          legal: LEGAL_VERSIONS,
          // De onde veio: só "convite", quando chegou pelo link de quem a chamou para gravar.
          ...(fromInvite ? { origem: "convite" } : {}),
        },
      },
    });

    if (error) {
      setError(authErrorMessage(error));
      setLoading(false);
    } else if (!data.session) {
      // Confirmação de e-mail ligada: a conta só entra depois do link.
      setSentTo(email);
      setLoading(false);
    } else {
      fillWithRec();
      router.push(next);
      router.refresh();
    }
  }

  if (sentTo) {
    return (
      <Entrada key="enviado" title="Criar conta no Gravaí">
        <h2 className="font-display text-2xl">Confirme seu e-mail</h2>
        <p className="leading-relaxed text-muted-foreground">
          Mandamos um link para <strong className="break-words text-foreground">{sentTo}</strong>. Abra no celular, toque no link e você já entra no Gravaí.
        </p>
        <p className="text-sm text-muted-foreground">Não chegou? Olhe a caixa de spam ou promoções.</p>
        <Link href={loginHref} className="mt-1 flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
          Já confirmei, quero entrar
        </Link>
      </Entrada>
    );
  }

  return (
    <Entrada title="Criar conta no Gravaí">
      <form onSubmit={handleRegister} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-12 bg-card text-base"
          />
        </div>
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
          <CampoSenha
            id="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-foreground"
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="font-semibold underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="font-semibold underline">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="mt-1 h-13 w-full rounded-full text-base font-bold" disabled={loading || !accepted}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar conta grátis
        </Button>
      </form>

      <Link href={loginHref} className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
        Já tenho conta
      </Link>
    </Entrada>
  );
}
