import type { Viewport } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { BarraComecar } from "@/components/gravai/barra-comecar";
import { Palco } from "@/components/gravai/palco";
import { COMPANY } from "@/lib/legal";

// O topo é escuro, como o login: a barra do navegador acompanha.
export const viewport: Viewport = { themeColor: "#0E0E0E" };

const questions = ["O que eu falo nos 3 primeiros segundos?", "O que aparece em cada plano?", "Em que ordem eu gravo?"];

const steps = [
  { n: "01", title: "Ideia", desc: "Ideias novas a cada 15 dias, já com o gancho dos 3 primeiros segundos." },
  { n: "02", title: "Roteiro", desc: "Escrito com você, parte por parte. Ou cole o seu e ele organiza." },
  { n: "03", title: "Pessoas", desc: "Cada pessoa recebe um link só com a parte dela, sem criar conta." },
  { n: "04", title: "Planos", desc: "Cada plano decidido antes de gravar, com o porquê." },
  { n: "05", title: "Gravar", desc: "No set, o teleprompter e um plano por vez." },
];

const questionsAndAnswers = [
  { q: "É de graça?", a: "Dá para começar sem pagar nada." },
  { q: "Precisa baixar?", a: "Não. Abre no navegador do celular, no Android e no iPhone." },
  { q: "Preciso entender de cinema?", a: "Não. O Gravaí explica cada termo na hora em que ele aparece." },
  { q: "Já tenho meu roteiro. Serve?", a: "Serve. Cole do jeito que está: ele organiza em partes e planos." },
];

const HIDE_BAR_ON = ["topo", "fim"];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div id="topo">
        <Palco
          linkHome={false}
          className="min-h-[92dvh] py-16"
          action={
            <Link href="/login" className="inline-flex min-h-11 items-center pl-3 text-sm font-semibold underline">
              Entrar
            </Link>
          }
          headline={<h1 className="mt-2 text-[1.375rem] font-bold leading-tight tracking-[-0.01em] sm:text-3xl">Da ideia ao vídeo gravado.</h1>}
        >
          <p className="mt-2 max-w-md leading-snug text-muted-foreground">Ideia, roteiro e planos do seu vídeo curto, prontos no celular.</p>
          <div className="mt-6 flex max-w-md flex-col gap-3">
            <Link href="/register" className="flex min-h-13 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              Começar de graça
            </Link>
            <p className="label-set text-center text-muted-foreground">Sem baixar nada · No celular</p>
          </div>
        </Palco>
      </div>

      <main className="palco-coluna flex flex-col gap-12 py-12">
        <section aria-labelledby="dor" className="flex flex-col gap-5">
          <h2 id="dor" className="font-display max-w-3xl text-[2.0625rem] sm:text-5xl">
            Você não trava na edição. Você trava antes de gravar.
          </h2>
          <ol>
            {questions.map((q, i) => (
              <li key={q} className="flex gap-3 border-t border-input py-3 leading-snug last:border-b">
                <span className="label-set pt-0.5 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {q}
              </li>
            ))}
          </ol>
          <p className="leading-relaxed">O Gravaí responde as três com você.</p>
        </section>

        <section aria-labelledby="como" className="flex flex-col gap-3">
          <h2 id="como" className="label-set text-muted-foreground">
            Como funciona
          </h2>
          <ol className="grid gap-3 sm:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
                <span className="label-set text-muted-foreground">{s.n}</span>
                <span className="text-lg font-bold leading-tight">{s.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{s.desc}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="duvidas" className="flex flex-col gap-3">
          <h2 id="duvidas" className="label-set text-muted-foreground">
            Dúvidas
          </h2>
          <div>
            {questionsAndAnswers.map(({ q, a }) => (
              <details key={q} className="group border-t border-input last:border-b">
                <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.75} aria-hidden="true" />
                </summary>
                <p className="pb-4 leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* O fim da página é um convite, não o rodapé legal. */}
      <div id="fim" className="dark flex flex-col items-center gap-6 bg-background px-4 pb-8 pt-14 text-foreground">
        <span className="flex size-28 items-center justify-center rounded-full border-[9px] border-foreground" aria-hidden="true">
          <span className="set-look size-16 rounded-full bg-rec" />
        </span>
        <h2 className="font-display text-center text-[2.75rem] sm:text-6xl">Bora gravar.</h2>
        <Link href="/register" className="flex min-h-13 w-full max-w-md items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
          Começar de graça
        </Link>

        <footer className="mt-6 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
          <a href={COMPANY.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">
            Instagram {COMPANY.instagramHandle}
          </a>
          <nav aria-label="Documentos" className="flex flex-wrap justify-center gap-x-4">
            <Link href="/termos" className="inline-flex min-h-11 items-center underline">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="inline-flex min-h-11 items-center underline">
              Política de Privacidade
            </Link>
            <Link href="/excluir-conta" className="inline-flex min-h-11 items-center underline">
              Excluir conta
            </Link>
          </nav>
          <p className="mt-1">© 2026 Gravaí · CNPJ {COMPANY.cnpj}</p>
        </footer>
      </div>

      <BarraComecar hideOn={HIDE_BAR_ON} />
    </div>
  );
}
