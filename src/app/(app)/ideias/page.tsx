import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FORMATS } from "@/lib/formats";
import { RadarSection } from "@/components/gravai/radar";
import { IdeiasQuinzena } from "@/components/gravai/ideias-quinzena";

// Ideias: as da quinzena (feitas para o perfil), o radar da semana e o caminho para a biblioteca de formatos.
export default function IdeiasPage() {
  return (
    <div className="flex flex-col gap-8">
      <IdeiasQuinzena />

      <RadarSection />

      <Link href="/ideias/formatos" className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
        <span className="flex flex-col gap-0.5">
          <span className="label-set">Biblioteca de formatos</span>
          <span className="text-sm text-muted-foreground">{FORMATS.length} estruturas que já funcionam</span>
        </span>
        <ArrowRight className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </div>
  );
}
