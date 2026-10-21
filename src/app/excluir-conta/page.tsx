import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "Excluir minha conta · Gravaí" };

// Página pública (exigida pelas lojas de apps): como excluir a conta, mesmo sem o app aberto.
export default function ExcluirContaPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 pb-16 pt-6">
      <Link href="/" aria-label="Gravaí">
        <Logo className="text-2xl" />
      </Link>
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">Privacidade</p>
        <h1 className="font-display text-[32px]">Excluir minha conta</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Pelo app (na hora)</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 leading-relaxed text-muted-foreground">
          <li>Entre no Gravaí.</li>
          <li>Toque em Perfil, no menu de baixo.</li>
          <li>Em “Privacidade e dados”, toque em “Excluir minha conta” e confirme.</li>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Por e-mail</h2>
        <p className="leading-relaxed text-muted-foreground">
          Se não conseguir entrar, escreva para <strong className="text-foreground">{COMPANY.email}</strong> a partir do e-mail da
          sua conta, pedindo a exclusão. Respondemos em até 15 dias.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">O que é apagado</h2>
        <p className="leading-relaxed text-muted-foreground">
          Sua conta, seu perfil, todos os vídeos com ideias, roteiros, planos e textos de publicação, as pessoas que você convidou,
          as autorizações de imagem que você recebeu, as ideias da quinzena e o registro dos aceites. Isso não tem volta.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Antes de excluir, você pode baixar uma cópia de tudo em Perfil › Privacidade e dados › Baixar meus dados.
        </p>
      </section>

      <Link href="/privacidade" className="min-h-11 text-sm font-semibold underline">
        Ler a Política de Privacidade
      </Link>
    </div>
  );
}
