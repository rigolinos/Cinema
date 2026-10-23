import Link from "next/link";
import { FORMATS } from "@/lib/formats";
import { RadarSection } from "@/components/gravai/radar";
import { IdeiasGuardadas } from "@/components/gravai/ideias-guardadas";
import { IdeiasQuinzena } from "@/components/gravai/ideias-quinzena";

// Ideias: as guardadas, as da quinzena (feitas para o perfil), o radar da semana e a biblioteca de formatos.
export default function IdeiasPage() {
  return (
    <div className="flex flex-col gap-8">
      <IdeiasGuardadas />

      <IdeiasQuinzena />

      <RadarSection />

      <section aria-labelledby="formatos" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h2 id="formatos" className="label-set">
            Biblioteca de formatos
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Um <strong className="text-foreground">formato</strong> é a estrutura do vídeo: a ordem em que as coisas acontecem.
            Escolha um que combine com você e troque só o assunto.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {FORMATS.map((f) => (
            <li key={f.slug} id={f.slug} className="flex scroll-mt-6 flex-col gap-3 rounded-2xl bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-bold">{f.name}</h3>
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
              <Link href={`/novo?formato=${f.slug}`} className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
                Usar este formato
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
