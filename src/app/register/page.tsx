"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { authCallbackUrl, authErrorMessage } from "@/lib/auth-errors";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [name, setName] = useState("");
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
        emailRedirectTo: authCallbackUrl(window.location.origin, "/inicio"),
        data: {
          full_name: name,
          org_name: `Estúdio de ${name.trim().split(/\s+/)[0] || "você"}`,
          // Versões aceitas: o banco registra o aceite junto com a criação da conta.
          legal: LEGAL_VERSIONS,
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
      router.push("/inicio");
      router.refresh();
    }
  }

  if (sentTo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex w-full max-w-md flex-col gap-6 text-center animate-scale-in">
          <Link href="/" aria-label="Início">
            <Logo className="text-4xl" />
          </Link>
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-6">
            <h1 className="text-xl font-bold">Confirme seu e-mail</h1>
            <p className="leading-relaxed text-muted-foreground">
              Mandamos um link para <strong className="text-foreground">{sentTo}</strong>. Abra no celular, toque no link e você
              já entra no Gravaí.
            </p>
            <p className="text-sm text-muted-foreground">Não chegou? Olhe a caixa de spam ou promoções.</p>
          </div>
          <Link href="/login" className="text-sm font-semibold underline">
            Já confirmei, quero entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="mb-8 text-center">
          <Link href="/" aria-label="Início">
            <Logo className="text-4xl" />
          </Link>
        </div>

        <Card className="border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Criar conta</CardTitle>
            <CardDescription>É grátis. Seu primeiro vídeo começa agora.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-background/50"
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
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-base font-bold"
                disabled={loading || !accepted}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar conta
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Entrar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
