import Link from "next/link";
import { FORMATS } from "@/lib/formats";

// Biblioteca de formatos: estruturas que funcionam em quase todo nicho.
export default function IdeiasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">Biblioteca</p>
        <h1 className="font-display text-[32px]">Formatos</h1>
        <p className="leading-relaxed text-muted-foreground">
          Um <strong className="text-foreground">formato</strong> é a estrutura do vídeo: a ordem em que as coisas acontecem.
          Escolha um que combine com você e troque só o assunto.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {FORMATS.map((f) => (
          <li key={f.slug} id={f.slug} className="flex scroll-mt-6 flex-col gap-3 rounded-2xl bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">{f.name}</h2>
              <span className="font-mono text-sm text-muted-foreground">
                {f.idealSeconds[0]}–{f.idealSeconds[1]} s
              </span>
            </div>
            <p className="text-[15px] leading-relaxed">{f.summary}</p>
            <ol className="flex flex-col gap-1">
              {f.structure.map((step, i) => (
                <li key={step} className="flex gap-2 text-sm">
                  <span className="font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
              <span className="label-set text-muted-foreground">Exemplo de gancho</span>
              <p className="text-[15px] font-semibold leading-snug">“{f.hookExample}”</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Por que funciona:</strong> {f.why}
            </p>
            {f.needsSomeone && <p className="label-set text-muted-foreground">Precisa de mais alguém</p>}
          </li>
        ))}
      </ul>

      <Link href="/novo" className="flex min-h-13 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
        Criar um vídeo
      </Link>
    </div>
  );
}
