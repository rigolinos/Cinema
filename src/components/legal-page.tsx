import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEGAL_UPDATED_AT, type LegalSection } from "@/lib/legal";

// Página pública de um documento legal (abre sem login).
export function LegalPage({ title, version, sections }: { title: string; version: string; sections: LegalSection[] }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 pb-16 pt-6">
      <Link href="/" aria-label="Gravaí">
        <Logo className="text-2xl" />
      </Link>
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">
          Versão {version.replace("v", "")} · atualizada em {LEGAL_UPDATED_AT}
        </p>
        <h1 className="font-display text-[32px]">{title}</h1>
      </header>
      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{s.title}</h2>
          {s.paragraphs.map((p) => (
            <p key={p} className="leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
      <nav aria-label="Documentos" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm font-semibold">
        <Link href="/termos" className="min-h-11 underline">
          Termos de Uso
        </Link>
        <Link href="/privacidade" className="min-h-11 underline">
          Política de Privacidade
        </Link>
        <Link href="/excluir-conta" className="min-h-11 underline">
          Excluir minha conta
        </Link>
      </nav>
    </div>
  );
}
