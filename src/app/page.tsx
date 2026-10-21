import Link from "next/link";
import { Logo } from "@/components/logo";

const steps = [
  { n: "01", title: "Ideia", desc: "Você conta o nicho e o objetivo. Saem ideias com o gancho dos 3 primeiros segundos." },
  { n: "02", title: "Roteiro", desc: "Escrito junto com você, na estrutura certa para Reels, TikTok ou YouTube." },
  { n: "03", title: "Pessoas", desc: "Quem aparece e quem filma, cada um com um link só com a parte dele." },
  { n: "04", title: "Planos", desc: "Cada cena vira as tomadas que você precisa, com o porquê de cada ângulo." },
  { n: "05", title: "Gravar", desc: "No celular: lista de planos, teleprompter e nada esquecido no dia." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo className="text-2xl" />
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-foreground px-5 text-sm font-semibold"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section className="border-b-2 border-foreground pb-12 pt-10 sm:pt-16">
          <p className="label-set text-muted-foreground">Seu parceiro de set</p>
          <h1 className="font-display mt-4 text-5xl sm:text-7xl">
            Da ideia ao
            <br />
            vídeo gravado.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            O Gravaí conversa com você e faz junto o trabalho de uma equipe: roteirista, diretor e produtor. Explica
            cada passo, sem jargão solto.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground"
            >
              <span className="size-2.5 rounded-full bg-rec" aria-hidden="true" />
              Bora gravar
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-13 items-center justify-center rounded-full border-[1.5px] border-foreground px-8 text-base font-semibold"
            >
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="py-12">
          <p className="label-set text-muted-foreground">Como funciona</p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col gap-2 rounded-xl bg-card p-5">
                <span className="label-set text-muted-foreground">{s.n}</span>
                <span className="text-lg font-bold">{s.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{s.desc}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026 Gravaí
      </footer>
    </div>
  );
}
